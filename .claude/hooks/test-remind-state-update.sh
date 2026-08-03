#!/usr/bin/env bash
# Ізольований тест remind-state-update.mjs — на fixture-репо, не на
# реальному /workspace (кількість "неврахованих" комітів тут постійно
# змінюється, тест на живому репо був би недетермінований).
# Запуск: bash .claude/hooks/test-remind-state-update.sh
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/remind-state-update.mjs"
fails=0

make_fixture() {
  local dir
  dir="$(mktemp -d)"
  (
    cd "$dir"
    git init -q
    git config user.email t@t.t
    git config user.name t
    mkdir -p docs
    echo "# STATE" > docs/STATE.md
    git add docs/STATE.md
    git commit -qm "docs: initial STATE.md"
  )
  echo "$dir"
}

echo "Кейс 1: нема нових комітів — тиша"
repo1="$(make_fixture)"
out1="$(cd "$repo1" && node "$HOOK")"
if [ -z "$out1" ]; then
  printf '  OK    %-46s мовчить\n' "нема нових комітів"
else
  printf '  ПРОВАЛ %-45s очікував тишу, отримав вивід\n' "нема нових комітів"
  echo "    $out1"
  fails=$((fails + 1))
fi
rm -rf "$repo1"

echo "Кейс 2: 1 коміт після STATE.md — правильна форма однини"
repo2="$(make_fixture)"
( cd "$repo2" && echo x > f.txt && git add f.txt && git commit -qm "feat: one" )
out2="$(cd "$repo2" && node "$HOOK")"
if echo "$out2" | grep -qF '1 коміт після'; then
  printf '  OK    %-46s "1 коміт" (не "1 комітів")\n' "однина"
else
  printf '  ПРОВАЛ %-45s очікував "1 коміт після"\n' "однина"
  echo "    $out2"
  fails=$((fails + 1))
fi
rm -rf "$repo2"

echo "Кейс 3: 3 коміти — форма 2-4"
repo3="$(make_fixture)"
( cd "$repo3"
  for i in 1 2 3; do echo "$i" > "f$i.txt" && git add "f$i.txt" && git commit -qm "feat: $i"; done
)
out3="$(cd "$repo3" && node "$HOOK")"
if echo "$out3" | grep -qF '3 коміти після'; then
  printf '  OK    %-46s "3 коміти"\n' "форма 2-4"
else
  printf '  ПРОВАЛ %-45s очікував "3 коміти після"\n' "форма 2-4"
  echo "    $out3"
  fails=$((fails + 1))
fi
rm -rf "$repo3"

echo "Кейс 4: 5 комітів — форма 5+"
repo4="$(make_fixture)"
( cd "$repo4"
  for i in 1 2 3 4 5; do echo "$i" > "f$i.txt" && git add "f$i.txt" && git commit -qm "feat: $i"; done
)
out4="$(cd "$repo4" && node "$HOOK")"
if echo "$out4" | grep -qF '5 комітів після'; then
  printf '  OK    %-46s "5 комітів"\n' "форма 5+"
else
  printf '  ПРОВАЛ %-45s очікував "5 комітів після"\n' "форма 5+"
  echo "    $out4"
  fails=$((fails + 1))
fi
rm -rf "$repo4"

echo "Кейс 4b: 11 комітів — виняток mod100 (не '11 коміт', хоч 11%10==1)"
repo4b="$(make_fixture)"
( cd "$repo4b"
  for i in $(seq 1 11); do echo "$i" > "f$i.txt" && git add "f$i.txt" && git commit -qm "feat: $i"; done
)
out4b="$(cd "$repo4b" && node "$HOOK")"
if echo "$out4b" | grep -qF '11 комітів після'; then
  printf '  OK    %-46s "11 комітів" (не "11 коміт")\n' "виняток mod100=11"
else
  printf '  ПРОВАЛ %-45s очікував "11 комітів після"\n' "виняток mod100=11"
  echo "    $out4b"
  fails=$((fails + 1))
fi
rm -rf "$repo4b"

echo "Кейс 5: docs/STATE.md поза git-історією — тиша, не падає"
repo5="$(mktemp -d)"
( cd "$repo5" && git init -q && git config user.email t@t.t && git config user.name t \
  && git commit -q --allow-empty -m "init" )
out5="$(cd "$repo5" && node "$HOOK" 2>&1)"
code5=$?
if [ -z "$out5" ] && [ "$code5" = 0 ]; then
  printf '  OK    %-46s мовчить, exit 0\n' "нема docs/STATE.md"
else
  printf '  ПРОВАЛ %-45s очікував тишу й exit 0, отримав exit %s\n' "нема docs/STATE.md" "$code5"
  echo "    $out5"
  fails=$((fails + 1))
fi
rm -rf "$repo5"

echo
if [ "$fails" = 0 ]; then
  echo "Усі кейси зелені."
else
  echo "Провалено кейсів: $fails"
  exit 1
fi
