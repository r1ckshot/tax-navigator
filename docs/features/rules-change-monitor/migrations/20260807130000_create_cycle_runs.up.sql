CREATE TABLE IF NOT EXISTS cycle_runs (
    id UUID PRIMARY KEY,
    month VARCHAR(7) NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (month)
);
