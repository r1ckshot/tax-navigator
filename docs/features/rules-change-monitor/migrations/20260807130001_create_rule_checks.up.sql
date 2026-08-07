CREATE TABLE IF NOT EXISTS rule_checks (
    id UUID PRIMARY KEY,
    cycle_id UUID NOT NULL REFERENCES cycle_runs(id),
    rule_id VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    source_value TEXT,
    matrix_value TEXT NOT NULL,
    source_url VARCHAR(255) NOT NULL,
    failure_reason VARCHAR(255),
    checked_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_checks_cycle_id ON rule_checks (cycle_id);
CREATE INDEX IF NOT EXISTS idx_rule_checks_rule_id ON rule_checks (rule_id);
