#!/usr/bin/env bash
# Ізольований тест check-settings-shape.mjs.
# Запуск: ./scripts/test-check-settings-shape.sh
#
# Фікстури — тимчасові файли, бо сам `.claude/settings.json` правити не можна
# (Claude Code його не редагує, а ламати робочий конфіг заради тесту не варіант).
# Кожен «поганий» кейс відтворює реальний клас помилки, а не вигаданий.
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/check-settings-shape.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fails=0

check() {
  local name="$1" expected="$2" json="$3"
  local file verdict
  file="$TMP/s.json"
  printf '%s' "$json" > "$file"
  if node "$CHECK" "$file" >/dev/null 2>&1; then verdict=pass; else verdict=fail; fi
  if [ "$verdict" = "$expected" ]; then
    printf '  OK    %-52s %s\n' "$name" "$verdict"
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$expected" "$verdict"
    fails=$((fails + 1))
  fi
}

echo "Valid shapes — must pass:"
check "empty object"                    pass '{}'
check "unknown keys are ignored"        pass '{"someFutureKey":{"deep":123}}'
check "attribution as text"             pass '{"attribution":{"commit":"Co-Authored-By: X","pr":"Y"}}'
check "attribution empty string hides"  pass '{"attribution":{"commit":""}}'
check "env with string values"          pass '{"env":{"A":"1"}}'
check "permissions arrays"              pass '{"permissions":{"allow":["Read"],"deny":["Bash(rm -rf *)"],"defaultMode":"acceptEdits"}}'
check "sandbox booleans and arrays"     pass '{"sandbox":{"enabled":true,"network":{"allowedDomains":["a.com"]}}}'
check "well-formed command hook"        pass '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"node x.mjs","timeout":10}]}]}}'

echo
echo "The bug that actually happened — must fail:"
check "attribution.commit = true"       fail '{"attribution":{"commit":true,"pr":true}}'
check "attribution.pr = false"          fail '{"attribution":{"pr":false}}'

echo
echo "Neighbouring type traps — must fail:"
check "env value is a number"           fail '{"env":{"TIMEOUT":300000}}'
check "deny is a string, not array"     fail '{"permissions":{"deny":"Bash(rm -rf *)"}}'
check "allow holds a non-string"        fail '{"permissions":{"allow":["Read",7]}}'
check "defaultMode outside the enum"    fail '{"permissions":{"defaultMode":"yolo"}}'
check "sandbox.enabled = \"true\""      fail '{"sandbox":{"enabled":"true"}}'
check "allowedDomains is a string"      fail '{"sandbox":{"network":{"allowedDomains":"zus.pl"}}}'
check "sessionUrl as string"            fail '{"attribution":{"sessionUrl":"yes"}}'

echo
echo "Hook structure — must fail:"
check "hooks event is not an array"     fail '{"hooks":{"PreToolUse":{"matcher":"Bash"}}}'
check "command hook without command"    fail '{"hooks":{"PreToolUse":[{"hooks":[{"type":"command"}]}]}}'
check "timeout as string"               fail '{"hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":"x","timeout":"10"}]}]}}'
check "inner hooks missing"             fail '{"hooks":{"SessionStart":[{"matcher":"Bash"}]}}'

echo
echo "Broken input:"
check "invalid JSON"                    fail '{"attribution":'

echo
if [ "$fails" -eq 0 ]; then
  echo "All cases passed."
else
  echo "$fails case(s) failed."
  exit 1
fi
