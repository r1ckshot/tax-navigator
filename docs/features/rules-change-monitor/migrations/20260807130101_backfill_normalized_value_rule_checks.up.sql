-- Phase 2/3 (backfill): idempotent — only touches rows the previous run missed.
-- This raw statement is the naive fallback (copies source_value verbatim); the real
-- normalization (parse-number-from-text, ADR-0001) runs via the batched cursor script,
-- see the companion doc: ../_audit/backfill-normalized_value.md.
UPDATE rule_checks
SET normalized_value = source_value
WHERE normalized_value IS NULL
  AND source_value IS NOT NULL;
