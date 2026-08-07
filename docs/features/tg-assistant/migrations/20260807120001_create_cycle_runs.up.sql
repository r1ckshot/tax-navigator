CREATE TABLE IF NOT EXISTS cycle_runs (
    id UUID PRIMARY KEY,
    week_of VARCHAR(10) NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (week_of)
);
