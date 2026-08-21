#!/usr/bin/env bash
# Ізольований тест git-хука .githooks/pre-commit.
# Запуск: ./.githooks/test-pre-commit.sh
#
# Кожен кейс піднімає одноразове репо, стейджить у ньому названі файли і прогоняє
# хук у тій теці: хук читає ІНДЕКС, тож підробити вхід рядком команди не можна —
# лише реальним `git add`. Ідентичність задається прапорцями, не глобальним
# конфігом (у CI його немає).
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/pre-commit"
fails=0

# «block» = exit 1, «pass» = exit 0.
case_run() {
  local name="$1" expected="$2" add_args="$3" files="$4"
  local dir code verdict
  dir=$(mktemp -d)
  (
    cd "$dir" || exit 1
    git init -q -b feat/x .
    for f in $files; do
      mkdir -p "$(dirname "$f")"
      printf 'X=1\n' > "$f"
    done
    printf '.env\n.env.*\n!.env.example\n' > .gitignore
    git add $add_args >/dev/null 2>&1
  ) >/dev/null 2>&1
  (cd "$dir" && bash "$HOOK") >/dev/null 2>&1
  code=$?
  rm -rf "$dir"
  [ "$code" = 0 ] && verdict=pass || verdict=block
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-46s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-46s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

echo "Secret in the index — must block:"
case_run "forced .env"              block "-f .env"          ".env"
case_run "forced .env.local"        block "-f .env.local"    ".env.local"
case_run "nested .env"              block "-f app/.env"      "app/.env"
# Головний кейс: секрет не названий у команді взагалі, форс знімає .gitignore.
case_run "forced whole directory"   block "-f ."             ".env app/page.tsx"

echo
echo "No secret staged — must pass:"
case_run "ordinary file"            pass  "app/page.tsx"     "app/page.tsx"
case_run ".env.example"             pass  ".env.example"     ".env.example"
# Без -f той самий каталог: .gitignore тримає .env поза індексом, хук мовчить.
case_run "plain add of directory"   pass  "."                ".env app/page.tsx"
case_run "file with env in name"    pass  "environment.ts"   "environment.ts"

echo
if [ "$fails" -eq 0 ]; then
  echo "All cases passed."
else
  echo "$fails case(s) failed."
  exit 1
fi
