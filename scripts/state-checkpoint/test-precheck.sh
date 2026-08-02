#!/usr/bin/env bash
# Ізольований тест — тільки детерміністична частина draft.sh (пошук межі
# "з останнього разу" через git log), без жодного виклику claude -p.
# Запуск: bash scripts/state-checkpoint/test-precheck.sh
#
# Чому окремо від draft.sh: сам агентний прогін коштує грошей і недетермінований
# (лекція 5.7: "variance — нормальна поведінка"), тому тут перевіряється лише
# те, що піддається детермінованій перевірці — межа комітів, яку draft.sh
# рахує ДО виклику Claude. `--dry-run` у draft.sh зупиняється рівно на цьому
# кроці, тож тест ганяє РЕАЛЬНИЙ код скрипта, а не його переказ.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRAFT="$SCRIPT_DIR/draft.sh"
fails=0

# Будує тимчасовий git-репо з docs/STATE.md і повертає його шлях.
make_fixture_repo() {
  local dir
  dir="$(mktemp -d)"
  (
    cd "$dir"
    git init -q
    git config user.email "test@example.com"
    git config user.name "test"
    mkdir -p docs
    echo "# STATE v1" > docs/STATE.md
    git add docs/STATE.md
    git commit -qm "docs: initial STATE.md"
  )
  echo "$dir"
}

check() {
  local name="$1" expected_exit="$2" repo="$3" expect_pattern="$4"
  local out code
  out="$(cd "$repo" && "$DRAFT" --dry-run 2>&1)"
  code=$?
  if [ "$code" != "$expected_exit" ]; then
    printf '  ПРОВАЛ %-50s очікував exit %s, отримав %s\n' "$name" "$expected_exit" "$code"
    echo "    output: $out" | head -5
    fails=$((fails + 1))
    return
  fi
  if [ -n "$expect_pattern" ] && ! grep -q "$expect_pattern" <<< "$out"; then
    printf '  ПРОВАЛ %-50s вивід не містить "%s"\n' "$name" "$expect_pattern"
    echo "    output: $out" | head -5
    fails=$((fails + 1))
    return
  fi
  printf '  OK    %-50s exit %s\n' "$name" "$code"
}

echo "Кейс 1: нема комітів після останнього дотику STATE.md → exit 0, нічого не чернетити"
repo1="$(make_fixture_repo)"
check "порожня межа" 0 "$repo1" "чернетити нічого"
rm -rf "$repo1"

echo "Кейс 2: N комітів після останнього дотику STATE.md → dry-run бачить усі N"
repo2="$(make_fixture_repo)"
(
  cd "$repo2"
  echo "feat 1" > f1.txt && git add f1.txt && git commit -qm "feat: one"
  echo "fix 1" > f2.txt && git add f2.txt && git commit -qm "fix: two"
  echo "chore 1" > f3.txt && git add f3.txt && git commit -qm "chore: three"
)
out2="$(cd "$repo2" && "$DRAFT" --dry-run 2>&1)"
covered=$(grep -c '^\s*[0-9a-f]\{7,\} ' <<< "$out2" || true)
if [ "$covered" = "3" ]; then
  printf '  OK    %-50s знайшов 3/3 коміти\n' "3 коміти після межі"
else
  printf '  ПРОВАЛ %-50s знайшов %s замість 3\n' "3 коміти після межі" "$covered"
  echo "    output: $out2"
  fails=$((fails + 1))
fi
rm -rf "$repo2"

echo "Кейс 3: STATE.md чіпали двічі → межа = ОСТАННІЙ дотик, не перший"
repo3="$(make_fixture_repo)"
(
  cd "$repo3"
  echo "irrelevant" > noise.txt && git add noise.txt && git commit -qm "chore: noise before second STATE touch"
  echo "# STATE v2" > docs/STATE.md && git add docs/STATE.md && git commit -qm "docs: second STATE.md touch"
  echo "feat after" > after.txt && git add after.txt && git commit -qm "feat: after second touch"
)
expected_hash="$(cd "$repo3" && git log -1 --format=%H -- docs/STATE.md)"
out3="$(cd "$repo3" && "$DRAFT" --dry-run 2>&1)"
if grep -q "$expected_hash" <<< "$out3" && grep -qc "^\s*[0-9a-f]\{7,\} feat: after second touch" <<< "$out3"; then
  printf '  OK    %-50s межа — саме другий дотик\n' "межа = останній дотик STATE.md"
else
  printf '  ПРОВАЛ %-50s очікував hash %s у виводі і лише коміт після нього\n' "межа = останній дотик STATE.md" "$expected_hash"
  echo "    output: $out3"
  fails=$((fails + 1))
fi
# noise-коміт (ДО другого дотику STATE.md) не повинен зʼявитись як "непокритий"
if grep -q "noise before second STATE touch" <<< "$out3"; then
  printf '  ПРОВАЛ %-50s noise-коміт до межі потрапив у "commits since"\n' "старий коміт не витікає за межу"
  fails=$((fails + 1))
else
  printf '  OK    %-50s старий коміт не витікає за межу\n' "старий коміт не витікає за межу"
fi
rm -rf "$repo3"

echo "Кейс 4: docs/STATE.md відсутній → exit 1 з чіткою помилкою"
repo4="$(mktemp -d)"
(cd "$repo4" && git init -q && git config user.email t@t.t && git config user.name t)
check "нема STATE.md" 1 "$repo4" "STATE.md"
rm -rf "$repo4"

echo "Кейс 5: не git-репозиторій → exit 1"
repo5="$(mktemp -d)"
mkdir -p "$repo5/docs" && echo "x" > "$repo5/docs/STATE.md"
check "не git-репо" 1 "$repo5" "git"
rm -rf "$repo5"

echo
if [ "$fails" = 0 ]; then
  echo "Усі кейси зелені."
else
  echo "Провалено кейсів: $fails"
  exit 1
fi
