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
# --max-turns 6: Read STATE.md → git log (межа) → git log (діапазон) →
# Read BACKLOG.md → Edit STATE.md → опційний re-Read, плюс один хід запасу.

RESPONSE="$(claude -p "$PROMPT" \
  --allowed-tools "Bash(git log *)" "Read(docs/**)" "Edit(docs/STATE.md)" \
  --model claude-haiku-4-5 \
  --output-format json \
  --json-schema "$SCHEMA" \
  --max-turns 6)"

# Нормалізуємо форму відповіді між версіями claude CLI (масив повідомлень
# у 2.x+, один обʼєкт з .result у старіших CLI) — той самий трюк, що й demo.
RESULT_OBJ=$(echo "$RESPONSE" | jq -c '
  if type == "array"
  then (map(select(.type == "result")) | last // {})
  else .
  end
')

COST=$(echo "$RESULT_OBJ" | jq -r '.total_cost_usd // "n/a"')
DURATION=$(echo "$RESULT_OBJ" | jq -r '.duration_ms // "n/a"')
TURNS=$(echo "$RESULT_OBJ" | jq -r '.num_turns // "n/a"')
IS_ERROR=$(echo "$RESULT_OBJ" | jq -r '.is_error // false')

echo "[claude] cost=\$${COST} duration=${DURATION}ms turns=${TURNS} is_error=${IS_ERROR}" >&2

if [[ "$IS_ERROR" == "true" ]]; then
  echo "[claude] агент повернув помилку — сира відповідь нижче" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# Валідований проти схеми JSON → stdout (structured_output у 2.x+, інакше
# fallback на парсинг .result).
echo "$RESULT_OBJ" | jq '
  if (.structured_output // null) != null
  then .structured_output
  else (.result as $r | try ($r | fromjson) catch $r)
  end
'

# Trust-but-verify: показуємо реальний diff, щоб рев'юер бачив точно, що
# агент змінив, окремо від JSON, який він повернув.
echo >&2
echo "--- реальний git diff (що агент відредагував у working tree) ---" >&2
git diff -- docs/STATE.md >&2 || true
echo "--- кінець git diff ---" >&2
echo >&2
echo "[hint] переглянь diff вище. Прийняти: відредагуй за потреби, тоді комітни." >&2
echo "[hint] Відхилити:  git restore docs/STATE.md" >&2
