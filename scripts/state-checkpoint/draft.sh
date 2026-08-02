#!/usr/bin/env bash
# draft.sh — просить Claude Agent SDK скласти чернетку блоку-чекпоінта
# "Закрито" для docs/STATE.md на основі git-історії.
#
# Форк курсового demo 5.7 (sdk-cli/release-notes.sh): та сама форма виклику
# claude -p (allowed-tools, пін моделі, json-schema, max-turns), та сама
# trust-модель (пропозиція у working tree, ніколи не комітиться). Адаптована
# ціль: у цьому проєкті нема CHANGELOG.md чи semver-тегів, тож межа "з
# останнього разу" — це "з останнього коміту, що чіпав STATE.md": сам
# STATE.md уже і є нашим append-only логом чекпоінтів.
#
# Використання:
#   scripts/state-checkpoint/draft.sh
#   scripts/state-checkpoint/draft.sh --dry-run   # лише pre-check, без виклику API
#   make state-checkpoint          # з кореня репо
#
# Вимоги:
#   - cwd — корінь репо tax-navigator (docs/STATE.md має існувати)
#   - claude CLI у PATH, jq у PATH
#   - Автентифікація: OAuth-сесія (`claude auth login`) або
#     ANTHROPIC_API_KEY env var (CI/CD) — ключ ніколи не хардкодити
#
# Що демонструє (чому саме ця задача — docs/DECISIONS.md)
#   - claude -p у headless-режимі з реальним agent loop (Read STATE.md →
#     Bash git log → Read BACKLOG.md → Edit STATE.md → опційний re-Read)
#   - Три незалежні виміри --allowed-tools: Bash-префікс, Read-глоб на
#     директорію, і Edit, звужений до РІВНО одного файлу (вужче за
#     Edit(docs/**) курсового demo — STATE.md єдиний канонічний файл, який
#     агенту взагалі дозволено чіпати)
#   - --max-turns як production-запобіжник бюджету
#   - --output-format json + --json-schema — чернетка валідується проти
#     схеми, не парситься з прози
#   - --model claude-haiku-4-5 — складання запису у стилі changelog з
#     git log це структурна задача read → transform → write по схемі, не
#     reasoning-задача
#
# Trust model
#   Агент редагує docs/STATE.md у working tree як *пропозицію*. Цей скрипт
#   НЕ комітить і не пушить. Після прогону — переглянути `git diff` і
#   вирішити:
#     - `git restore docs/STATE.md`                    — відхилити чернетку
#     - відредагувати вручну, тоді закомітити           — прийняти (можливо, переформульовано)
#     - `git diff -- docs/STATE.md > checkpoint.patch` — перенести деінде

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"

# ──────────────────────────────────────────────────────────────────
# Pre-flight
# ──────────────────────────────────────────────────────────────────

if [[ ! -d ".git" ]]; then
  echo "ПОМИЛКА: cwd не є коренем git-репозиторію." >&2
  echo "         Запускай з кореня репо tax-navigator." >&2
  exit 1
fi

if [[ ! -f "docs/STATE.md" ]]; then
  echo "ПОМИЛКА: docs/STATE.md не знайдено — запускай з кореня репо." >&2
  exit 1
fi

# --dry-run не потребує нічого з блоку нижче: вправляє лише pre-check
# (пошук межі чекпоінта STATE.md), який чистий git і вартий тестування без
# мережі й без витрати API-бюджету. Див. test-precheck.sh.
if [[ "$DRY_RUN" -eq 0 ]]; then
  # Приймаємо або OAuth-сесію (claude auth login), або env var (CI/CD).
  # Порядок важливий: у CI env var завжди присутній, тож перевіряємо його
  # першим і уникаємо виклику `claude auth status` (може впасти без OAuth).
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    : # env var присутній — ОК
  elif claude auth status --json 2>/dev/null | grep -q '"loggedIn": true'; then
    : # OAuth-сесія активна — ОК
  else
    echo "ПОМИЛКА: не автентифіковано до Claude." >&2
    echo "         Обери одне:" >&2
    echo "           - 'claude auth login' (OAuth, для локальної розробки)" >&2
    echo "           - або export ANTHROPIC_API_KEY (CI/CD, GitHub Secrets)" >&2
    exit 1
  fi

  if ! command -v claude >/dev/null 2>&1; then
    echo "ПОМИЛКА: claude CLI не знайдено у PATH." >&2
    exit 1
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "ПОМИЛКА: jq не знайдено у PATH." >&2
    exit 1
  fi

  if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "ПОМИЛКА: файл промпта відсутній: $PROMPT_FILE" >&2
    exit 1
  fi
fi

# ──────────────────────────────────────────────────────────────────
# Pre-check — економимо токени, якщо нічого не змінилось з останньої
# правки STATE.md (за зразком pre-check кроку в sdk-python).
# ──────────────────────────────────────────────────────────────────

LAST_STATE_COMMIT="$(git log -1 --format=%H -- docs/STATE.md)"
COMMITS_SINCE="$(git log "$LAST_STATE_COMMIT"..HEAD --oneline)"

if [[ -z "$COMMITS_SINCE" ]]; then
  echo "[state-checkpoint] docs/STATE.md уже відображає HEAD — чернетити нічого." >&2
  exit 0
fi

echo "[state-checkpoint] останній коміт STATE.md: $LAST_STATE_COMMIT" >&2
echo "[state-checkpoint] коміти після нього:" >&2
echo "$COMMITS_SINCE" | sed 's/^/  /' >&2

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[state-checkpoint] --dry-run: зупиняюсь до виклику claude -p." >&2
  exit 0
fi

PROMPT="$(cat "$PROMPT_FILE")"

# ──────────────────────────────────────────────────────────────────
# JSON schema — валідується проти фінальної відповіді Claude
# ──────────────────────────────────────────────────────────────────

SCHEMA='{
  "type": "object",
  "properties": {
    "date":             {"type": "string"},
    "heading":          {"type": "string"},
    "bullets":          {"type": "array", "items": {"type": "string"}},
    "commits_covered":  {"type": "integer"}
  },
  "required": ["date", "heading", "bullets", "commits_covered"]
}'

# ──────────────────────────────────────────────────────────────────
# Виклик Claude — реальний agent loop з трьома вимірами прав доступу
# ──────────────────────────────────────────────────────────────────
#
#   Bash → git log *        — лише читання історії, ніколи git commit/push/tag
#   Read → docs/**          — контекст формату STATE.md + назви задач з BACKLOG.md
#   Edit → docs/STATE.md    — рівно один файл, не вся директорія docs/
#
# --max-turns 15: Read STATE.md → git log (межа) → git log (діапазон,
# --name-status) → Read BACKLOG.md → Edit STATE.md → опційний re-Read.
# Живі прогони показали, що 6, 8 і 10 послідовно замало (is_error: true /
# error_max_turns) — модель регулярно робить кілька додаткових read/re-read
# понад мінімальний happy path; 15 — емпірично підібраний запас, не здогад.
#
# env -u ...: коли цей скрипт запускається з-під ІНТЕРАКТИВНОЇ сесії Claude
# Code (а не з голого терміналу), змінні CLAUDECODE / CLAUDE_CODE_* / AI_AGENT
# протікають у це дочірнє середовище — зокрема CLAUDE_CODE_SESSION_ID
# ІДЕНТИЧНИЙ батьківській сесії. Вкладений `claude -p`, побачивши це,
# намагається торкнутись того самого session-стану (checkpointing/lock), що й
# батьківська сесія — а та в цей момент сама заблокована, чекаючи на
# завершення ЦЬОГО-таки Bash-виклику: дедлок на файловому лоці.
# Підтверджено емпірично на реальному Bash(git log)-виклику: з цими
# змінними процес висів у D-стані (uninterruptible I/O wait) — timeout 60
# послав SIGTERM вчасно, але сигнал не міг доставитись, поки D-стан не
# розвʼязався сам за ~5 хв; без змінних той самий виклик стабільно
# завершується за ~9с. CLAUDE_CONFIG_DIR свідомо НЕ знімається — без нього
# Claude Code не бачить довіру до /workspace і ігнорує permissions.allow
# з .claude/settings.json. При запуску з голого терміналу (реальний
# сценарій використання цього скрипта) жодної з цих змінних нема, і env -u
# просто нічого не робить — безпечно завжди.
# `if RESPONSE=$(...)` навмисно, а не голе присвоєння: під `set -e` голе
# `RESPONSE="$(claude -p ...)"` обриває скрипт МОВЧКИ в момент, коли claude
# повертає ненульовий exit (а він так робить і на is_error: true), — тоді
# ніхто не побачить ні summary, ні git diff, навіть якщо Edit уже реально
# застосувався у working tree (підтверджено живим прогоном: на
# error_max_turns Edit іноді встигає відпрацювати ДО вичерпання ходів).
if RESPONSE="$(env \
  -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_PID \
  -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING \
  -u CLAUDE_CODE_SUBPROCESS_ENV_SCRUB -u CLAUDE_CODE_ENABLE_TASKS \
  -u CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY -u CLAUDE_CODE_ENTRYPOINT \
  -u CLAUDE_CODE_EXECPATH -u CLAUDE_AGENT_SDK_VERSION \
  -u CLAUDE_AUTOCOMPACT_PCT_OVERRIDE -u CLAUDE_EFFORT -u AI_AGENT \
  claude -p "$PROMPT" \
  --allowed-tools "Bash(git log *)" "Read(docs/**)" "Edit(docs/STATE.md)" \
  --model claude-haiku-4-5 \
  --output-format json \
  --json-schema "$SCHEMA" \
  --max-turns 15)"; then
  CLAUDE_EXIT=0
else
  CLAUDE_EXIT=$?
fi

# Нормалізуємо форму відповіді між версіями claude CLI (масив повідомлень
# у 2.x+, один обʼєкт з .result у старіших CLI) — той самий трюк, що й demo.
RESULT_OBJ=$(echo "$RESPONSE" | jq -c '
  if type == "array"
  then (map(select(.type == "result")) | last // {})
  else .
  end
' 2>/dev/null || echo '{}')

COST=$(echo "$RESULT_OBJ" | jq -r '.total_cost_usd // "n/a"')
DURATION=$(echo "$RESULT_OBJ" | jq -r '.duration_ms // "n/a"')
TURNS=$(echo "$RESULT_OBJ" | jq -r '.num_turns // "n/a"')
IS_ERROR=$(echo "$RESULT_OBJ" | jq -r '.is_error // false')

echo "[claude] exit=${CLAUDE_EXIT} cost=\$${COST} duration=${DURATION}ms turns=${TURNS} is_error=${IS_ERROR}" >&2

if [[ "$IS_ERROR" == "true" || "$CLAUDE_EXIT" -ne 0 ]]; then
  echo "[claude] агент повернув помилку — сира відповідь нижче" >&2
  echo "$RESPONSE" >&2
  ERRORED=1
else
  ERRORED=0
  # Валідований проти схеми JSON → stdout (structured_output у 2.x+, інакше
  # fallback на парсинг .result).
  echo "$RESULT_OBJ" | jq '
    if (.structured_output // null) != null
    then .structured_output
    else (.result as $r | try ($r | fromjson) catch $r)
    end
  '
fi

# Trust-but-verify: показуємо реальний diff НЕЗАЛЕЖНО від is_error — Edit
# міг застосуватись до того, як агент вичерпав ходи чи впав на схемі.
# Порожній diff тут при is_error означає, що Edit справді не відбувся;
# непорожній diff при is_error — сигнал: чернетка часткова, дивись уважно.
echo >&2
echo "--- реальний git diff (що агент відредагував у working tree) ---" >&2
git diff -- docs/STATE.md >&2 || true
echo "--- кінець git diff ---" >&2
echo >&2
echo "[hint] переглянь diff вище. Прийняти: відредагуй за потреби, тоді комітни." >&2
echo "[hint] Відхилити:  git restore docs/STATE.md" >&2

if [[ "$ERRORED" -eq 1 ]]; then
  exit 1
fi
