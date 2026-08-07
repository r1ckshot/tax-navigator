-- Phase 3/3 (contract): backfill (phase 2) must be confirmed complete before this deploys.
ALTER TABLE rule_checks ALTER COLUMN normalized_value SET NOT NULL;
