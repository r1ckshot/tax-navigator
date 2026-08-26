#!/usr/bin/env bash
# Ізольований тест хука — до прив'язки в settings.json.
# Запуск: bash .claude/hooks/test-task-completed-gate.sh
#
# Кожен кейс подає хуку payload TaskCompleted у stdin і звіряє exit code:
#   2 = задачу закрити не дали, 0 = пропущено.
#
# Хук дивиться на стан git, тож кейси ганяються не в цьому репо, а в пісочниці:
# `git init` + seed-коміт, як в `evals/sandbox.py`. Інакше тест залежав би від
# того, що зараз брудне в робочій копії, і був би недетермінованим.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/task-completed-gate.mjs"
SANDBOX="$(mktemp -d)"
COUNTER="$SANDBOX/verify-runs.txt"
export COUNTER
trap 'rm -rf "$SANDBOX"' EXIT

REPO="$SANDBOX/repo"
mkdir -p "$REPO"/{app/lib/calc,.claude/hooks,docs,other}
printf 'export const x = 1;\n' > "$REPO/app/lib/calc/x.ts"
printf '// hook\n' > "$REPO/.claude/hooks/y.mjs"
printf 'docs\n' > "$REPO/docs/z.md"
printf 'other\n' > "$REPO/other/w.txt"
git -C "$REPO" -c init.defaultBranch=main init -q
git -C "$REPO" -c core.hooksPath=/dev/null -c user.email=t@example.test -c user.name=Test \
  add -A >/dev/null && git -C "$REPO" -c core.hooksPath=/dev/null \
  -c user.email=t@example.test -c user.name=Test commit -qm seed

plan() { cat > "$SANDBOX/plan.json"; }

# Базовий план: дві задачі-власники + нейтральна територія docs/.
plan_default() {
  plan <<'JSON'
{
  "neutral": ["docs/"],
  "tasks": [
    {"id":"audit-calc","subject_match":"calc","owns":["app/lib/calc/"],"mode":"read-only",
     "verify":["printf x >> \"$COUNTER\""]},
    {"id":"audit-hooks","subject_match":"hook","owns":[".claude/hooks/"],"mode":"write",
     "verify":["true"]}
  ]
}
JSON
}

fails=0
check() {
  local name="$1" expected="$2" subject="$3" task_id="${4:-T1}"
  rm -rf "$SANDBOX/cache"
  jq -nc --arg s "$subject" --arg i "$task_id" \
    '{hook_event_name:"TaskCompleted",task_id:$i,task_subject:$s,teammate_name:"peer-1"}' \
    | TASK_GATE_CWD="$REPO" TASK_GATE_PLAN="$SANDBOX/plan.json" TASK_GATE_CACHE="$SANDBOX/cache" \
      node "$HOOK" >/dev/null 2>&1
  local code=$?
  if [ "$code" = "$expected" ]; then
    printf '  OK    %-54s exit %s\n' "$name" "$code"
  else
    printf '  ПРОВАЛ %-53s очікував %s, отримав %s\n' "$name" "$expected" "$code"
    fails=$((fails + 1))
  fi
}

# Кейс із власним payload (межові форми).
check_raw() {
  local name="$1" expected="$2" payload="$3"
  rm -rf "$SANDBOX/cache"
  printf '%s' "$payload" \
    | TASK_GATE_CWD="$REPO" TASK_GATE_PLAN="$SANDBOX/plan.json" TASK_GATE_CACHE="$SANDBOX/cache" \
      node "$HOOK" >/dev/null 2>&1
  local code=$?
  if [ "$code" = "$expected" ]; then
    printf '  OK    %-54s exit %s\n' "$name" "$code"
  else
    printf '  ПРОВАЛ %-53s очікував %s, отримав %s\n' "$name" "$expected" "$code"
    fails=$((fails + 1))
  fi
}

clean_tree() { git -C "$REPO" -c core.hooksPath=/dev/null checkout -- . 2>/dev/null; \
  git -C "$REPO" clean -qfd 2>/dev/null; }

plan_default

echo "Тема задачі проти плану:"
clean_tree
check "тема лягла на одну задачу"            0 "Аудит calc"
check "тема поза планом"                     2 "Причесати README"
check "порожня тема"                         2 ""

echo "Тема, що лягає на дві задачі (план з перетином):"
plan <<'JSON'
{
  "neutral": [],
  "tasks": [
    {"id":"a","subject_match":"аудит","owns":["app/"],"mode":"read-only","verify":["true"]},
    {"id":"b","subject_match":"calc","owns":["app/lib/calc/"],"mode":"read-only","verify":["true"]}
  ]
}
JSON
check "неоднозначна тема"                    2 "Аудит calc"
plan_default

echo "Територія:"
clean_tree
printf 'dirty\n' >> "$REPO/other/w.txt"
check "зміна поза оголошеними територіями"   2 "Аудит calc"
clean_tree
printf 'new\n' > "$REPO/app/components.tsx"
check "новий файл у неоголошеній теці"       2 "Аудит calc"
clean_tree
printf 'dirty\n' >> "$REPO/docs/z.md"
check "зміна на нейтральній території"       0 "Аудит calc"
clean_tree
printf 'dirty\n' >> "$REPO/.claude/hooks/y.mjs"
check "чужа оголошена територія брудна"      0 "Аудит calc"

echo "read-only проти write:"
clean_tree
printf 'dirty\n' >> "$REPO/app/lib/calc/x.ts"
check "read-only задача записала у власну"   2 "Аудит calc"
clean_tree
printf 'hotfix\n' > "$REPO/app/lib/calc/hotfix.ts"
check "read-only: новий untracked файл"      2 "Аудит calc"
clean_tree
printf 'dirty\n' >> "$REPO/.claude/hooks/y.mjs"
check "write задача записала у власну"       0 "Аудит hooks"

echo "Verify — стан, а не слова:"
clean_tree
plan <<'JSON'
{
  "neutral": ["docs/"],
  "tasks": [{"id":"red","subject_match":"calc","owns":["app/lib/calc/"],"mode":"read-only",
             "verify":["true","false"]}]
}
JSON
check "червона перевірка володіння"          2 "Аудит calc"
plan <<'JSON'
{
  "neutral": ["docs/"],
  "tasks": [{"id":"empty","subject_match":"calc","owns":["app/lib/calc/"],"mode":"read-only",
             "verify":[]}]
}
JSON
check "задача без жодної перевірки"          2 "Аудит calc"
plan_default

echo "Ідемпотентність (12 подій на задачу — норма, не аномалія):"
clean_tree
: > "$COUNTER"
rm -rf "$SANDBOX/cache"
fire() {
  jq -nc --arg s "$1" '{hook_event_name:"TaskCompleted",task_id:"T9",task_subject:$s}' \
    | TASK_GATE_CWD="$REPO" TASK_GATE_PLAN="$SANDBOX/plan.json" TASK_GATE_CACHE="$SANDBOX/cache" \
      node "$HOOK" >/dev/null 2>&1
  printf '%s' "$?"
}
codes="$(fire 'Аудит calc')$(fire 'Аудит calc')$(fire 'Аудит calc')"
runs=$(wc -c < "$COUNTER" | tr -d ' ')
if [ "$codes" = "000" ] && [ "$runs" = "1" ]; then
  printf '  OK    %-54s 3 події, %s прогін verify\n' "три події поспіль" "$runs"
else
  printf '  ПРОВАЛ %-53s коди %s, прогонів verify %s\n' "три події поспіль" "$codes" "$runs"
  fails=$((fails + 1))
fi
# Дерево змінилось — старий PASS уже нічого не доводить, verify має піти знову.
printf 'dirty\n' >> "$REPO/docs/z.md"
code=$(fire 'Аудит calc')
runs=$(wc -c < "$COUNTER" | tr -d ' ')
if [ "$code" = "0" ] && [ "$runs" = "2" ]; then
  printf '  OK    %-54s дерево змінилось, %s прогони\n' "кеш не переживає зміну дерева" "$runs"
else
  printf '  ПРОВАЛ %-53s код %s, прогонів %s\n' "кеш не переживає зміну дерева" "$code" "$runs"
  fails=$((fails + 1))
fi
clean_tree

echo "Межові (не має падати):"
check_raw "битий JSON"                       0 '{ це не json'
check_raw "порожній stdin"                   0 ''
check_raw "інша подія (TaskCreated)"         0 '{"hook_event_name":"TaskCreated","task_id":"1","task_subject":"Аудит calc"}'
rm -f "$SANDBOX/plan.json"
check_raw "плану немає"                      2 '{"hook_event_name":"TaskCompleted","task_id":"1","task_subject":"Аудит calc"}'
plan_default

echo
if [ "$fails" = 0 ]; then
  echo "Усі кейси зелені."
else
  echo "Провалено кейсів: $fails"
  exit 1
fi
