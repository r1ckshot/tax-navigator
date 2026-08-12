#!/usr/bin/env bash
# Ізольований тест verify-tg-assistant-migrations.mjs.
# Запуск: ./scripts/test-verify-tg-assistant-migrations.sh
#
# Кейс 1 — реальні staged-міграції tg-assistant мають пройти roundtrip і
# збігтися з data-model.md → Entities. Кейс 2 — навмисно зіпсована копія
# однієї міграції (прибрана колонка) має впасти з повідомленням, що називає
# конкретну таблицю й колонку, а не просто "error".
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY="$ROOT/scripts/verify-tg-assistant-migrations.mjs"
MIGRATIONS="$ROOT/docs/features/tg-assistant/migrations"
DATA_MODEL="$ROOT/docs/features/tg-assistant/data-model.md"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fails=0

echo "Case 1 — real migrations, must pass:"
if out=$(node --experimental-sqlite "$VERIFY" --migrations-dir "$MIGRATIONS" --data-model "$DATA_MODEL" 2>&1); then
  echo "  OK    real staged migrations roundtrip clean"
  echo "        $out" | grep -v ExperimentalWarning | grep -v trace-warnings
else
  echo "  FAIL  expected exit 0, got non-zero"
  echo "        $out"
  fails=$((fails + 1))
fi

echo
echo "Case 2 — corrupted migration (chats.title column removed), must fail with a specific message:"
CORRUPT="$TMP/migrations"
cp -r "$MIGRATIONS" "$CORRUPT"
cat > "$CORRUPT/20260807120000_create_chats.up.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY,
    telegram_chat_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (telegram_chat_id)
);
SQL

if out=$(node --experimental-sqlite "$VERIFY" --migrations-dir "$CORRUPT" --data-model "$DATA_MODEL" 2>&1); then
  echo "  FAIL  expected non-zero exit on corrupted migration, got 0"
  echo "        $out"
  fails=$((fails + 1))
else
  if echo "$out" | grep -q "chats" && echo "$out" | grep -q "title"; then
    echo "  OK    failed as expected, message names table+column:"
    echo "        $(echo "$out" | grep -v ExperimentalWarning | grep -v trace-warnings)"
  else
    echo "  FAIL  failed, but message does not name the specific table/column:"
    echo "        $out"
    fails=$((fails + 1))
  fi
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "All cases passed."
else
  echo "$fails case(s) failed."
  exit 1
fi
