CREATE TABLE IF NOT EXISTS cycle_runs (
    id TEXT PRIMARY KEY,
    week_of TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (week_of)
);
