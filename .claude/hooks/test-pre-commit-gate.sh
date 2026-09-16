#!/usr/bin/env bash
# Ізольований тест хука pre-commit-gate.mjs.
# Запуск: bash .claude/hooks/test-pre-commit-gate.sh
#
# На відміну від решти хуків, цей віддає рішення не exit-кодом, а JSON-ом
# (permissionDecision), тож звіряємо stdout. Перевіряється РОУТИНГ (чи хук взагалі
# бере команду) і кирилична перевірка — обидві спрацьовують до запуску `npm test`,
# тож тест лишається швидким і не залежить від стану репо.
#
# Привід: до 2026-08-03 хук покладався на `if: Bash(git commit*)` у settings.json.
# Поле не фільтрує — хук отримував КОЖНУ Bash-команду, ганяв на ній повний
# `npm test` + `npm run verify` і блокував будь-який рядок із кирилицею.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/pre-commit-gate.mjs"
fails=0

# «pass» = хук нічого не сказав (команда не його справа або гейт зелений);
# «deny» = у stdout є permissionDecision deny.
check() {
  local name="$1" expected="$2" command="$3"
  local out verdict
  out=$(printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$command" | node "$HOOK" 2>/dev/null)
  if printf '%s' "$out" | grep -q '"permissionDecision":"deny"'; then verdict=deny; else verdict=pass; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

echo "Not a commit at all — hook must stay out of the way (pass):"
check "echo with Cyrillic text"            pass '"echo тест"'
check "vitest run"                         pass '"npx vitest run"'
check "git log"                            pass '"git log --oneline -5"'
check "git push"                           pass '"git push origin feat/x"'
check "grep for the word commit"           pass '"grep -rn commit docs/"'
check "git commit-tree (plumbing)"         pass '"git commit-tree abc123"'
check "word commit inside a string"        pass '"echo \"commit later\""'

echo
echo "Staging a secret — must deny (the check fires on git add, not on commit):"
check "git add .env"                       deny '"git add .env"'
check "git add -f .env"                    deny '"git add -f .env"'
check "git add --force .env.local"         deny '"git add --force .env.local"'
check "nested .env"                        deny '"git add mcp/evidence-guard/.env"'
check "after another command"              deny '"git status && git add .env.production"'
check "forced whole directory"             deny '"git add -f ."'
check "forced -A"                          deny '"git add -f -A"'

echo
echo "Legitimate staging — must pass:"
check "ordinary file"                      pass '"git add app/lib/calc/index.ts"'
check ".env.example"                       pass '"git add .env.example"'
check "plain git add ."                    pass '"git add ."'
check "plain git add -A"                   pass '"git add -A"'
check "file with env in the name"          pass '"git add app/lib/environment.ts"'
check "reading .env, not staging"          pass '"grep -c X .env"'

echo
echo "Real commit with Cyrillic in the message — must deny:"
check "subject in Ukrainian"               deny '"git commit -m \"виправлення\""'
check "flags between git and commit"       deny '"git -c user.name=x commit -m \"тест\""'
check "compound command"                   deny '"npm test && git commit -m \"тест\""'
check "Cyrillic in heredoc body"           deny '"git commit -F- <<EOF\nтіло\nEOF"'
check "amend with Cyrillic"                deny '"git commit --amend -m \"тест\""'
# Гейт читав ЛИШЕ перший git-сегмент і на цьому рядку відповідав "це не коміт".
check "commit after another git subcommand" deny '"git log --oneline && git commit -m \"тест\""'

echo
echo "Attribution trailer — marker: the reason names Co-Authored-By."

# Той самий приклад, що й у гілкових кейсах: на фіче-гілці хук іде далі й падає на
# `npm test` (у fixture нема package.json), тож саме pass/deny нічого не розрізняє —
# звіряти треба ТЕКСТ причини. Заразом fixture тримає тест швидким: жоден кейс не
# доходить до справжнього прогону тестів цього репо.
trailer_case() {
  local name="$1" expected="$2" command="$3"
  local dir out verdict
  dir=$(mktemp -d)
  (cd "$dir" && git init -q -b feat/x . && git commit -q --allow-empty -m init) >/dev/null 2>&1
  out=$(cd "$dir" && printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$command" | node "$HOOK" 2>/dev/null)
  rm -rf "$dir"
  if printf '%s' "$out" | grep -q 'Co-Authored-By'; then verdict=deny-trailer; else verdict=passed-trailer-gate; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

trailer_case "subject only, no trailer"    deny-trailer        '"git commit -m \"fix: x\""'
trailer_case "body but still no trailer"   deny-trailer        '"git commit -m \"fix: x\" -m \"why it broke\""'
trailer_case "trailer present"             passed-trailer-gate '"git commit -m \"fix: x\" -m \"Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\""'
# Модель у трейлері міняється разом із /model — гейт не має її знати.
trailer_case "trailer names another model" passed-trailer-gate '"git commit -m \"fix: x\" -m \"Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>\""'
# Повідомлення не в команді: редактор, --amend --no-edit, -C HEAD. Трейлера в
# рядку нема за побудовою, і гейт мусить мовчати, інакше блокує законні коміти.
trailer_case "editor commit"               passed-trailer-gate '"git commit"'
trailer_case "amend --no-edit"             passed-trailer-gate '"git commit --amend --no-edit"'
trailer_case "reuse message from HEAD"     passed-trailer-gate '"git commit -C HEAD"'

echo
echo "Branch gate — fixture repos, real HEAD (marker: the hint about checkout -b):"

# Гілку не підробити стабільно з поточного репо, тож кожен кейс отримує свій
# одноразовий репозиторій. Маркер у reason важливий: на фіче-гілці хук теж
# віддає deny (у fixture нема package.json, тож `npm test` падає) — і без звірки
# ТЕКСТУ причини кейс "гілковий чек пропустив" був би нерозрізненний від блоку.
branch_case() {
  local name="$1" expected="$2" branch="$3" seed="${4:-with-commit}"
  local dir out verdict
  dir=$(mktemp -d)
  if [ "$seed" = "unborn" ]; then
    (cd "$dir" && git init -q -b "$branch" .) >/dev/null 2>&1
    out=$(cd "$dir" && printf '{"tool_name":"Bash","tool_input":{"command":"git commit -m \\"fix: x\\""}}' | node "$HOOK" 2>/dev/null)
    rm -rf "$dir"
    if printf '%s' "$out" | grep -q 'checkout -b'; then verdict=deny-branch; else verdict=passed-branch-gate; fi
    if [ "$verdict" = "$expected" ]; then
      printf '  OK    %-52s %s\n' "$name" "$verdict"
    else
      printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
      fails=$((fails + 1))
    fi
    return
  fi
  # Ідентичність — прапорцями, а не з глобального конфігу: у CI його нема, коміт
  # мовчки не створювався, гілка лишалась ненародженою, і кейс "коміт у master"
  # ставав зеленим через дірку в хуку, а не через справність. Знайдено релізом 1.1.0.
  (
    cd "$dir" || exit 1
    git init -q -b "$branch" .
    git -c user.email=ci@example.com -c user.name=ci commit -q --allow-empty -m init
  ) >/dev/null 2>&1
  out=$(cd "$dir" && printf '{"tool_name":"Bash","tool_input":{"command":"git commit -m \\"fix: x\\""}}' | node "$HOOK" 2>/dev/null)
  rm -rf "$dir"
  if printf '%s' "$out" | grep -q 'checkout -b'; then verdict=deny-branch; else verdict=passed-branch-gate; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

branch_case "commit on master"             deny-branch         master
branch_case "commit on main"               deny-branch         main
branch_case "commit on feat/x"             passed-branch-gate  feat/x
branch_case "commit on docs/cleanup"       passed-branch-gate  docs/cleanup
branch_case "branch named masterpiece"     passed-branch-gate  masterpiece

# Репо без ЖОДНОГО коміта — гілка ненароджена, `rev-parse` падає. Саме цей стан
# ховав дірку в хуку до 2026-08-05: перший коміт у свіжому репо йшов повз гейт.
branch_case "first commit ever, on master" deny-branch         master       unborn
branch_case "first commit ever, on feat/x" passed-branch-gate  feat/x       unborn

echo
echo "Worktree gate — commit runs somewhere else than the hook (marker: checkout -b):"

# Хук стартує в корені сесії, а з М9 коміти йдуть із worktree. Фікстура тримає
# обидва дерева одразу: корінь на master і linked worktree на feat/x. Кейси
# ганяються з КОРЕНЯ — тобто рівно в тих умовах, у яких хук працює насправді.
worktree_case() {
  local name="$1" expected="$2" command_from_root="$3"
  local dir out verdict
  dir=$(mktemp -d)
  (
    cd "$dir" || exit 1
    git init -q -b master root
    cd root || exit 1
    git -c user.email=ci@example.com -c user.name=ci commit -q --allow-empty -m init
    git worktree add -q ../wt -b feat/x
  ) >/dev/null 2>&1
  # WT= підставляється в команду кейса вже після створення фікстури.
  local command=${command_from_root//WT/$dir\/wt}
  out=$(cd "$dir/root" && printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$command" | node "$HOOK" 2>/dev/null)
  rm -rf "$dir"
  if printf '%s' "$out" | grep -q 'checkout -b'; then verdict=deny-branch; else verdict=passed-branch-gate; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

worktree_case "git -C <worktree on feat/x>"  passed-branch-gate '"git -C WT commit -m \"fix: x\""'
worktree_case "cd <worktree> && git commit"  passed-branch-gate '"cd WT && git commit -m \"fix: x\""'
worktree_case "cd <worktree>, then git add"  passed-branch-gate '"cd WT && git add a.txt && git commit -m \"fix: x\""'
# Корінь фікстури сидить на master: без -C/cd гілка та сама, що й була, — блок.
worktree_case "no -C, hook stays on master"  deny-branch        '"git commit -m \"fix: x\""'
# Шлях, якого нема (змінна, підстановка шелла): гейт мусить впасти назад на
# корінь сесії й судити по ньому, а не мовчки пропустити коміт.
worktree_case "nonexistent -C path"          deny-branch        '"git -C /nope/nope commit -m \"fix: x\""'

echo
echo "Record-only branch — the ceremony gate (own sandbox repo):"
# Своя пісочниця, бо чек читає стан git: гілку, коміти попереду master і індекс.
# Судити по робочій копії репо не можна — тест став би недетермінованим.
CEREMONY="$(mktemp -d)"
trap 'rm -rf "$CEREMONY"' EXIT
G() { git -C "$CEREMONY" -c core.hooksPath=/dev/null -c user.email=t@example.test -c user.name=Test "$@"; }
mkdir -p "$CEREMONY/docs" "$CEREMONY/app"
printf 'seed\n' > "$CEREMONY/app/x.ts"
printf 'seed\n' > "$CEREMONY/docs/STATE.md"
G -c init.defaultBranch=master init -q .
G add -A >/dev/null && G commit -qm seed

# Хук читає стан того каталогу, в якому його запустили, тож кейс іде з cd.
ceremony_case() {
  local name="$1" expected="$2" command="$3"
  local out verdict
  out=$(printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$command" \
    | (cd "$CEREMONY" && node "$HOOK") 2>/dev/null)
  if printf '%s' "$out" | grep -q 'один PR на робочий шматок'; then verdict=deny; else verdict=pass; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

# 1. Гілка лише із записом у STATE.md — саме той патерн, що тримався весь M9-M10.
G checkout -q -b docs/state-followup
printf 'record\n' >> "$CEREMONY/docs/STATE.md"
G add docs/STATE.md >/dev/null
ceremony_case "commit of a records-only branch"     deny '"git commit -m \"docs(state): note\""'

# PR судиться по закомічених змінах — тому кейс іде після коміту, як у житті.
G commit -qm "docs(state): note"
ceremony_case "gh pr create for the same branch"    deny '"gh pr create --draft --title x --body-file b.md"'

# 2. Та сама гілка, але в ній уже лежить справжня робота: запис — фінальний
#    коміт того самого шматка, а не другий PR.
printf 'work\n' >> "$CEREMONY/app/x.ts"
G add app/x.ts >/dev/null && G commit -qm "feat: real work"
ceremony_case "records ride along with real work"   pass '"gh pr create --draft --title x --body-file b.md"'

# 3. Feature-документи це самостійна робота, не запис про неї.
G checkout -q -b docs/prd-something master
mkdir -p "$CEREMONY/docs/features/slug"
printf 'PRD\n' > "$CEREMONY/docs/features/slug/PRD.md"
G add -A >/dev/null && G commit -qm "docs(prd): slug"
ceremony_case "docs/features/<slug>/PRD.md branch"  pass '"gh pr create --draft --title x --body-file b.md"'

# 4. На master чек мовчить — там працює окремий чек про гілку.
G checkout -q master
ceremony_case "on master the gate stays out"        pass '"gh pr create --draft --title x --body-file b.md"'

echo
echo "Second PR for the same chunk — the overlap gate (own sandbox repo):"
# Ще одна пісочниця: цей чек читає merge-історію master, якої в попередній немає.
CHUNK="$(mktemp -d)"
trap 'rm -rf "$CEREMONY" "$CHUNK"' EXIT
K() { git -C "$CHUNK" -c core.hooksPath=/dev/null -c user.email=t@example.test -c user.name=Test "$@"; }
mkdir -p "$CHUNK/docs" "$CHUNK/app"
printf 'seed\n' > "$CHUNK/app/a.ts"
printf 'seed\n' > "$CHUNK/app/b.ts"
printf 'seed\n' > "$CHUNK/docs/STATE.md"
K -c init.defaultBranch=master init -q .
K add -A >/dev/null && K commit -qm seed

chunk_case() {
  local name="$1" expected="$2" command="$3"
  local out verdict
  out=$(printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$command" \
    | (cd "$CHUNK" && node "$HOOK") 2>/dev/null)
  if printf '%s' "$out" | grep -q 'щойно поїхали в master'; then verdict=deny; else verdict=pass; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

PR='"gh pr create --draft --title x --body-file b.md"'

# Шматок №1 зливається в master просто зараз: чіпає app/a.ts і docs/STATE.md.
K checkout -q -b feat/chunk-one
printf 'work\n' >> "$CHUNK/app/a.ts"
printf 'record\n' >> "$CHUNK/docs/STATE.md"
K add -A >/dev/null && K commit -qm "feat: chunk one"
K checkout -q master
K merge -q --no-ff feat/chunk-one -m "Merge pull request #1 from feat/chunk-one"

# 1. Забута правка того ж шматка повертається в той самий файл — це і є патерн.
K checkout -q -b docs/forgot-a-bit master
printf 'more\n' >> "$CHUNK/app/a.ts"
K add -A >/dev/null && K commit -qm "fix: forgot a bit"
chunk_case "same file as a merge minutes ago"       deny "$PR"

# 2. Інший файл — справді новий шматок, чек мовчить.
K checkout -q -b feat/chunk-two master
printf 'work\n' >> "$CHUNK/app/b.ts"
K add -A >/dev/null && K commit -qm "feat: chunk two"
chunk_case "different file, genuinely new chunk"    pass "$PR"

# 3. Перетин ЛИШЕ по записах не рахується: STATE.md чіпає майже кожен PR.
#    Тому в гілці є і своя справжня робота — інакше спрацював би 5-й чек.
K checkout -q -b feat/chunk-three master
printf 'work\n' >> "$CHUNK/app/b.ts"
printf 'record\n' >> "$CHUNK/docs/STATE.md"
K add -A >/dev/null && K commit -qm "feat: chunk three"
chunk_case "overlap only on records"                pass "$PR"

# 4. Той самий файл, але мерж старий: за межею вікна це новий шматок, не хвіст.
K checkout -q -b feat/chunk-old master
printf 'old\n' >> "$CHUNK/app/old.ts"
K add -A >/dev/null && K commit -qm "feat: old chunk"
K checkout -q master
OLD_DATE="$(date -d '2 days ago' -Iseconds)"
GIT_COMMITTER_DATE="$OLD_DATE" GIT_AUTHOR_DATE="$OLD_DATE" \
  K -c user.email=t@example.test -c user.name=Test merge -q --no-ff feat/chunk-old -m "Merge pull request #0 from feat/chunk-old"
K checkout -q -b feat/much-later master
printf 'later\n' >> "$CHUNK/app/old.ts"
K add -A >/dev/null && K commit -qm "feat: much later"
chunk_case "same file, merge outside the window"    pass "$PR"

# 5. Перетин ЛИШЕ по карті не рахується: карту чіпає майже кожен шматок.
#    Знайдено на власному прикладі — гілка з цим-таки чеком оновлювала
#    TEAM-CONTOUR.md, бо документує сам хук, і була ним же заблокована.
K checkout -q -b feat/map-chunk master
printf 'map\n' > "$CHUNK/docs/TEAM-CONTOUR.md"
printf 'work\n' >> "$CHUNK/app/a.ts"
K add -A >/dev/null && K commit -qm "feat: map chunk"
K checkout -q master
K merge -q --no-ff feat/map-chunk -m "Merge pull request #2 from feat/map-chunk"
K checkout -q -b feat/next-hook master
printf 'map row\n' >> "$CHUNK/docs/TEAM-CONTOUR.md"
printf 'work\n' >> "$CHUNK/app/b.ts"
K add -A >/dev/null && K commit -qm "feat: next hook"
chunk_case "overlap only on the contour map"        pass "$PR"

# 6. Коміт цей чек не чіпає — він стоїть тільки на gh pr create.
chunk_case "plain git commit is not this gate"      pass '"git commit -m \"feat: x\""'

echo
if [ "$fails" -eq 0 ]; then
  echo "All cases passed."
else
  echo "$fails case(s) failed."
  exit 1
fi
