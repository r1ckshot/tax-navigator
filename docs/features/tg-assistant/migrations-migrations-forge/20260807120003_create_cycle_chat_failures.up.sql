CREATE TABLE IF NOT EXISTS cycle_chat_failures (
    id TEXT PRIMARY KEY,
    cycle_run_id TEXT NOT NULL REFERENCES cycle_runs(id),
    chat_id TEXT NOT NULL REFERENCES chats(id),
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_cycle_chat_failures_cycle_run_id ON cycle_chat_failures (cycle_run_id);
CREATE INDEX IF NOT EXISTS idx_cycle_chat_failures_chat_id ON cycle_chat_failures (chat_id);
