CREATE TABLE IF NOT EXISTS veto_entries (
    id UUID PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    vetoed_value VARCHAR(255) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    source_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veto_entries_rule_id ON veto_entries (rule_id);
