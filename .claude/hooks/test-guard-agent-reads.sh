#!/usr/bin/env bash
# Ізольований тест хука — до прив'язки в settings.json.
# Запуск: bash .claude/hooks/test-guard-agent-reads.sh
#
# Кожен кейс подає хуку JSON-payload у stdin і звіряє exit code:
#   2 = заблоковано, 0 = пропущено.
#
# Предмет тут — ІНСТРУМЕНТ, не команда. `readonly-bash.mjs` боронить `.env` від
# `cat` усередині `Bash`; цей хук закриває ту саму ціль для `Read`/`Grep`/`Glob`,
# бо в `drift-reviewer` `Bash` немає взагалі й перший хук для нього мовчить.
set -uo pipefail

HOOK="$(dirname "$0")/guard-agent-reads.mjs"
fails=0

check() {
  local name="$1" expected="$2" payload="$3"
  printf '%s' "$payload" | node "$HOOK" >/dev/null 2>&1
  local code=$?
  if [ "$code" = "$expected" ]; then
    printf '  OK    %-56s exit %s\n' "$name" "$code"
  else
    printf '  ПРОВАЛ %-55s очікував %s, отримав %s\n' "$name" "$expected" "$code"
    fails=$((fails + 1))
  fi
}

# payload суб-агента: інструмент, ім'я агента, аргумент зі шляхом.
as_agent() { jq -nc --arg t "$1" --arg a "$2" --arg k "$3" --arg v "$4" \
  '{tool_name:$t,agent_type:$a,tool_input:{($k):$v}}'; }
# payload без agent_type — так виглядає виклик із головного треда.
as_main() { jq -nc --arg t "$1" --arg k "$2" --arg v "$3" \
  '{tool_name:$t,tool_input:{($k):$v}}'; }

echo "drift-reviewer — секрети й конфігурація агента (exit 2):"
check ".env відносним шляхом"        2 "$(as_agent Read drift-reviewer file_path '.env')"
check ".env абсолютним шляхом"       2 "$(as_agent Read drift-reviewer file_path '/workspace/.env')"
check ".env.local"                   2 "$(as_agent Read drift-reviewer file_path '/workspace/.env.local')"
check "Grep по теці .env"            2 "$(as_agent Grep drift-reviewer path '/workspace/.env')"
check "правило агента"               2 "$(as_agent Read drift-reviewer file_path '/workspace/.claude/agents/drift-reviewer.md')"
check "settings.json агентів"        2 "$(as_agent Read drift-reviewer file_path '.claude/settings.json')"
check "Glob по .claude"              2 "$(as_agent Glob drift-reviewer pattern '.claude/**/*.mjs')"
check "Grep із path у .claude"       2 "$(as_agent Grep drift-reviewer path '/workspace/.claude/hooks')"

# Обхід, знайдений рев'ю: у payload немає слова .claude ВЗАГАЛІ, тож перевірка
# імен його не бачить, а ripgrep заходить у теку сам. Ловиться лише позитивним
# списком тек пошуку.
echo "drift-reviewer — пошук, що дістає .claude не назвавши її (exit 2):"
check "Grep від кореня репо"         2 "$(as_agent Grep drift-reviewer path '/workspace')"
check "Grep від поточної теки"       2 "$(as_agent Grep drift-reviewer path '.')"
check "Grep узагалі без path"        2 "$(as_agent Grep drift-reviewer pattern 'ANTHROPIC')"
check "Grep --glob у .claude"        2 "$(as_agent Grep drift-reviewer glob '.claude/**')"
check "Grep --glob у .env"           2 "$(as_agent Grep drift-reviewer glob '**/.env')"
check "Glob від кореня"              2 "$(as_agent Glob drift-reviewer pattern '**/*.md')"

echo "drift-reviewer — його власна робота (exit 0):"
check "історія циклів"               0 "$(as_agent Read drift-reviewer file_path '/workspace/scripts/rules-change-monitor/data/cycle-history.json')"
check "матриця правил"               0 "$(as_agent Read drift-reviewer file_path '/workspace/app/lib/rules/rules.2026.json')"
check "перелік станів"               0 "$(as_agent Read drift-reviewer file_path 'scripts/rules-change-monitor/states.mjs')"
check ".env.example"                 0 "$(as_agent Read drift-reviewer file_path '/workspace/.env.example')"
check "Grep у теці нарізки"          0 "$(as_agent Grep drift-reviewer path '/workspace/scripts/rules-change-monitor')"
check "Grep у теці правил"           0 "$(as_agent Grep drift-reviewer path 'app/lib/rules')"
check "Glob у теці нарізки"          0 "$(as_agent Glob drift-reviewer pattern 'scripts/rules-change-monitor/*.mjs')"

echo "інші агенти — .claude і пошук їм потрібні, .env ні (0 і 2):"
check "ro-reviewer читає правило"    0 "$(as_agent Read ro-reviewer file_path '.claude/rules/product-safety.md')"
check "diff-reviewer читає правило"  0 "$(as_agent Read diff-reviewer file_path '.claude/rules/evidence-numbers.md')"
check "rules-auditor читає правило"  0 "$(as_agent Read rules-auditor file_path '.claude/rules/evidence-numbers.md')"
check "explorer шукає по репо"       0 "$(as_agent Grep explorer path '/workspace')"
check "ro-reviewer і .env"           2 "$(as_agent Read ro-reviewer file_path '/workspace/.env')"
check "explorer і .env"              2 "$(as_agent Read explorer file_path '.env')"
check "explorer і --glob .env"       2 "$(as_agent Grep explorer glob '**/.env')"

# Головний тред пізнається НЕ по порожньому полю: сусідній readonly-bash.mjs
# документує, що туди кладуть `mainThreadAgentType()`. Гейт по списку імен із
# `.claude/agents/`, тож будь-яке значення поза ним проходить.
echo "головний тред — не чіпаємо (exit 0):"
check "Mike читає .env"              0 "$(as_main Read file_path '/workspace/.env')"
check "Mike читає .claude"           0 "$(as_main Read file_path '.claude/settings.json')"
check "непорожній agent_type треда"  0 "$(as_agent Read main-thread file_path '/workspace/.env.local')"
check "тред шукає по репо"           0 "$(as_agent Grep general-purpose path '/workspace')"

echo "службове (exit 0):"
check "битий payload"                0 'не json'
check "порожній payload"             0 '{}'
check "без шляху взагалі"            0 "$(as_agent Read drift-reviewer pattern 'x')"

if [ "$fails" -gt 0 ]; then
  printf '\n%s кейсів провалено\n' "$fails"
  exit 1
fi
printf '\nусі кейси пройдено\n'
