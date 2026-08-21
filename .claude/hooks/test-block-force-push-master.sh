#!/usr/bin/env bash
# Ізольований тест хука block-force-push-master.mjs.
# Запуск: bash .claude/hooks/test-block-force-push-master.sh
#
# Кожен кейс подає хуку JSON-payload у stdin і звіряє exit code:
# 2 = заблоковано, 0 = пропущено.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/block-force-push-master.mjs"
fails=0

check() {
  local name="$1" expected="$2" payload="$3" cwd="${4:-.}"
  local code
  ( cd "$cwd" && printf '%s' "$payload" | node "$HOOK" >/dev/null 2>&1 )
  code=$?
  if [ "$code" = "$expected" ]; then
    printf '  OK    %-46s exit %s\n' "$name" "$code"
  else
    printf '  ПРОВАЛ %-45s очікував %s, отримав %s\n' "$name" "$expected" "$code"
    fails=$((fails + 1))
  fi
}

cmd_payload() { printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$1"; }

echo "Позитивні, force (явна гілка master, мусить заблокувати, exit 2):"
check "--force origin master"          2 "$(cmd_payload '"git push --force origin master"')"
check "-f origin master"               2 "$(cmd_payload '"git push -f origin master"')"
check "--force-with-lease origin master" 2 "$(cmd_payload '"git push --force-with-lease origin master"')"
check "прапорець після remote"         2 "$(cmd_payload '"git push origin --force master"')"
check "refspec HEAD:master"            2 "$(cmd_payload '"git push --force origin HEAD:master"')"
check "у складеній команді"            2 "$(cmd_payload '"npm test && git push --force origin master"')"

# Урок 9.3: звичайний push у master перестав бути дозволеним. Кейс нижче ще
# в першій версії стояв як негативний (exit 0) — вимога змінилась, не тест
# підігнаний під код.
echo "Позитивні, звичайний push (мусить заблокувати, exit 2):"
check "звичайний push у master"        2 "$(cmd_payload '"git push origin master"')"
check "звичайний push у main"          2 "$(cmd_payload '"git push origin main"')"
check "refspec гілка:master"           2 "$(cmd_payload '"git push origin feat/foo:master"')"
check "refspec refs/heads/master"      2 "$(cmd_payload '"git push origin HEAD:refs/heads/master"')"
check "видалення master"               2 "$(cmd_payload '"git push origin --delete master"')"
check "push-option зі значенням"       2 "$(cmd_payload '"git push -o ci.skip origin master"')"

echo "Негативні (мусить пропустити, exit 0):"
check "push у названу гілку"           0 "$(cmd_payload '"git push -u origin feat/foo"')"
check "--force у чужу гілку"           0 "$(cmd_payload '"git push --force origin feat/foo"')"
check "--force-with-lease у чужу гілку" 0 "$(cmd_payload '"git push --force-with-lease origin feat/foo"')"
check "тег із назвою не master"        0 "$(cmd_payload '"git push origin v0.1.0"')"
check "не push"                        0 "$(cmd_payload '"git log --oneline"')"

echo "Межові (не має падати, exit 0):"
check "порожній payload"               0 '{}'
check "порожній stdin"                 0 ''
check "битий JSON"                     0 '{ це не json'

echo "Неявна гілка (git push БЕЗ назви гілки — ціль = поточна, fixture-репо):"

FIXTURE_MASTER="$(mktemp -d)"
( cd "$FIXTURE_MASTER" && git init -q -b master && git config user.email t@t.t && git config user.name t \
  && git commit -q --allow-empty -m "init" )
check "поточна гілка master — блок"         2 "$(cmd_payload '"git push --force"')"           "$FIXTURE_MASTER"
check "поточна гілка master, з remote"      2 "$(cmd_payload '"git push --force origin"')"     "$FIXTURE_MASTER"
check "голий git push з master — блок"      2 "$(cmd_payload '"git push"')"                    "$FIXTURE_MASTER"
check "git push origin з master — блок"     2 "$(cmd_payload '"git push origin"')"             "$FIXTURE_MASTER"
# Реліз 9.7 тегує з master: теги гілку не рухають, тож під заборону не підпадають.
check "--tags з master — пропуск"           0 "$(cmd_payload '"git push origin --tags"')"      "$FIXTURE_MASTER"
rm -rf "$FIXTURE_MASTER"

FIXTURE_FEATURE="$(mktemp -d)"
( cd "$FIXTURE_FEATURE" && git init -q -b feature && git config user.email t@t.t && git config user.name t \
  && git commit -q --allow-empty -m "init" )
check "поточна гілка НЕ master — пропуск"   0 "$(cmd_payload '"git push --force"')"           "$FIXTURE_FEATURE"
check "голий git push НЕ з master"          0 "$(cmd_payload '"git push"')"                    "$FIXTURE_FEATURE"
rm -rf "$FIXTURE_FEATURE"

echo
if [ "$fails" = 0 ]; then
  echo "Усі кейси зелені."
else
  echo "Провалено кейсів: $fails"
  exit 1
fi
