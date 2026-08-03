#!/usr/bin/env bash
# Ізольований тест SessionStart-хука для протермінованих verified_at.
# Запуск: bash .claude/hooks/test-session-stale-rules.sh
#
# STALE_RULES_TEST_NOW підміняє "сьогодні", щоб тест не залежав від
# реальної дати запуску (усі правила зараз свіжі — без підміни тест на
# "є протерміновані" завжди був би зеленим випадково, а не за конструкцією).
set -uo pipefail

HOOK="$(dirname "$0")/session-stale-rules.mjs"
fails=0

check_empty() {
  local name="$1" now="$2"
  local out
  out="$(STALE_RULES_TEST_NOW="$now" node "$HOOK" 2>&1)"
  if [ -z "$out" ]; then
    printf '  OK    %-46s мовчить (нічого протермінованого)\n' "$name"
  else
    printf '  ПРОВАЛ %-45s очікував тишу, отримав вивід\n' "$name"
    echo "    $out"
    fails=$((fails + 1))
  fi
}

check_nonempty() {
  local name="$1" now="$2" expect_substr="$3"
  local out
  out="$(STALE_RULES_TEST_NOW="$now" node "$HOOK" 2>&1)"
  if [ -n "$out" ] && echo "$out" | grep -qF "$expect_substr"; then
    printf '  OK    %-46s повідомляє про застарілі\n' "$name"
  else
    printf '  ПРОВАЛ %-45s очікував вивід із "%s"\n' "$name" "$expect_substr"
    echo "    $out"
    fails=$((fails + 1))
  fi
}

echo "Межа порогу (найновіше правило verified_at 2026-07-29):"
check_empty    "рівно на порозі (89 днів від найстарішого)"  "2026-10-15"
check_nonempty "за порогом (91+ днів від найстарішого)"      "2026-10-30" "residency.days_threshold"

echo "Реалістичні сценарії:"
check_empty    "сьогодні = дата останньої звірки"            "2026-07-29"
check_nonempty "далеке майбутнє — усі протерміновані"        "2027-02-01" "Протерміновані правила"

echo
if [ "$fails" = 0 ]; then
  echo "Усі кейси зелені."
else
  echo "Провалено кейсів: $fails"
  exit 1
fi
