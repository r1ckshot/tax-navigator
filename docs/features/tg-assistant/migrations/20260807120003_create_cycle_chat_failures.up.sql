CREATE TABLE IF NOT EXISTS cycle_chat_failures (
    id UUID PRIMARY KEY,
    cycle_run_id UUID NOT NULL REFERENCES cycle_runs(id),
    chat_id UUID NOT NULL REFERENCES chats(id),
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycle_chat_failures_cycle_run_id ON cycle_chat_failures (cycle_run_id);
CREATE INDEX IF NOT EXISTS idx_cycle_chat_failures_chat_id ON cycle_chat_failures (chat_id);
