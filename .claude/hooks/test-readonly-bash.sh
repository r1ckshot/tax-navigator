#!/usr/bin/env bash
# Ізольований тест хука — до прив'язки в settings.json.
# Запуск: bash .claude/hooks/test-readonly-bash.sh
#
# Кожен кейс подає хуку JSON-payload у stdin і звіряє exit code:
#   2 = заблоковано, 0 = пропущено.
#
# Ключова відмінність від інших хуків репо: тут має значення поле agent_type.
# Той самий текст команди мусить пройти в головному треді й впертись у стіну
# всередині read-only агента.
set -uo pipefail

HOOK="$(dirname "$0")/readonly-bash.mjs"
fails=0

check() {
  local name="$1" expected="$2" payload="$3"
  printf '%s' "$payload" | node "$HOOK" >/dev/null 2>&1
  local code=$?
  if [ "$code" = "$expected" ]; then
    printf '  OK    %-52s exit %s\n' "$name" "$code"
  else
    printf '  ПРОВАЛ %-51s очікував %s, отримав %s\n' "$name" "$expected" "$code"
    fails=$((fails + 1))
  fi
}

# payload з іменем агента; команда йде через jq — вкладені лапки рахує він.
as_agent() { jq -nc --arg a "$1" --arg c "$2" \
  '{tool_name:"Bash",agent_type:$a,tool_input:{command:$c}}'; }
# payload без agent_type — так виглядає виклик із головного треда.
as_main() { jq -nc --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }

echo "diff-reviewer — дозволене (exit 0):"
check "git diff"                  0 "$(as_agent diff-reviewer 'git diff')"
check "git status --porcelain"    0 "$(as_agent diff-reviewer 'git status --porcelain')"
check "git log з прапорцями"      0 "$(as_agent diff-reviewer 'git log --oneline -5')"
check "rg по репо"                0 "$(as_agent diff-reviewer 'rg -n verified_at app/lib')"
check "читання файла"             0 "$(as_agent diff-reviewer 'cat app/lib/rules/rules.2026.json')"
check "конвеєр із двох дозволених" 0 "$(as_agent diff-reviewer 'git diff | grep -n source_url')"

echo "diff-reviewer — запис і виконання (exit 2):"
check "редирект у файл"           2 "$(as_agent diff-reviewer 'git diff > /tmp/out.txt')"
check "редирект створює файл у репо" 2 "$(as_agent diff-reviewer 'echo probe > probe.txt')"
check "дозапис"                   2 "$(as_agent diff-reviewer 'git log >> log.txt')"
check "git add"                   2 "$(as_agent diff-reviewer 'git add -A')"
check "git commit"                2 "$(as_agent diff-reviewer 'git commit -m x')"
check "git checkout"              2 "$(as_agent diff-reviewer 'git checkout -- .')"
check "sed -i"                    2 "$(as_agent diff-reviewer 'sed -i s/a/b/ app/page.tsx')"
check "npm test"                  2 "$(as_agent diff-reviewer 'npm test')"
check "rm"                        2 "$(as_agent diff-reviewer 'rm -f probe.txt')"
check "tee у конвеєрі"            2 "$(as_agent diff-reviewer 'git diff | tee out.txt')"
check "друга команда після &&"    2 "$(as_agent diff-reviewer 'git diff && rm -f x')"
check "друга команда після ;"     2 "$(as_agent diff-reviewer 'git status; touch x')"
check "підстановка \$( )"         2 "$(as_agent diff-reviewer 'git log $(whoami)')"
check "бектіки"                   2 "$(as_agent diff-reviewer 'git log `whoami`')"
check "\$IFS замість пробілу"     2 "$(as_agent diff-reviewer 'git${IFS}add${IFS}-A')"
check "find -delete"              2 "$(as_agent diff-reviewer 'find . -name x -delete')"
check "шлях замість імені"        2 "$(as_agent diff-reviewer '/usr/bin/env rm -f x')"

echo "env-scout — свій, вужчий список:"
check "curl -o /dev/null"         0 "$(as_agent env-scout "curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://zus.pl/")"
check "getent"                    0 "$(as_agent env-scout 'getent hosts zus.pl')"
check "command -v"                0 "$(as_agent env-scout 'command -v gh')"
check "node --version"            0 "$(as_agent env-scout 'node --version')"
check "curl пише у файл"          2 "$(as_agent env-scout 'curl -o dump.html https://zus.pl/')"
check "curl -O"                   2 "$(as_agent env-scout 'curl -sO https://zus.pl/file.zip')"
check "node -e довільний код"     2 "$(as_agent env-scout "node -e \"require('fs').writeFileSync('x','1')\"")"
check "npm install"               2 "$(as_agent env-scout 'npm install left-pad')"

echo "Агент поза списком хука — межа в нього інша (exit 0):"
# rules-auditor не має Bash у `tools` взагалі, тож звужувати нічого:
# його гарантія — набір інструментів, не цей хук.
check "rules-auditor"             0 "$(as_agent rules-auditor 'git diff')"

echo "Головний тред — хук не втручається (exit 0):"
check "той самий git add"         0 "$(as_main 'git add -A')"
check "той самий редирект"        0 "$(as_main 'echo probe > probe.txt')"
check "npm test"                  0 "$(as_main 'npm test')"

echo "Межові (не має падати, exit 0):"
check "порожній payload"          0 '{}'
check "порожній stdin"            0 ''
check "битий JSON"                0 '{ це не json'
check "агент без command"         0 '{"tool_name":"Bash","agent_type":"diff-reviewer","tool_input":{}}'
check "не Bash-інструмент"        0 '{"tool_name":"Read","agent_type":"diff-reviewer","tool_input":{"file_path":"a"}}'
check "невідомий агент"           0 '{"tool_name":"Bash","agent_type":"explorer","tool_input":{"command":"npm test"}}'

echo
if [ "$fails" = 0 ]; then
  echo "Усі кейси зелені."
else
  echo "Провалено кейсів: $fails"
  exit 1
fi
