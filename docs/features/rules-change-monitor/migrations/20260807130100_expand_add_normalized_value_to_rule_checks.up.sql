-- Phase 1/3 (expand): nullable column, dual-write starts in app code (normalize.mjs)
-- from this migration onward. Not NOT NULL yet — existing rows have no value.
ALTER TABLE rule_checks ADD COLUMN IF NOT EXISTS normalized_value TEXT;
