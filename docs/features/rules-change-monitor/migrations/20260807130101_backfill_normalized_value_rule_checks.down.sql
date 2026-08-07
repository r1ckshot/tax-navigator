-- No-op by design: a data backfill is not "unbackfilled" by nulling values back out —
-- that would delete real data with no benefit. Rolling back this phase means rolling back
-- the expand phase's down.sql instead, which drops the column (and the data with it).
SELECT 1;
