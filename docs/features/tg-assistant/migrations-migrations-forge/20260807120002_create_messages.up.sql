CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id),
    telegram_message_id INTEGER NOT NULL,
    week_of TEXT NOT NULL,
    content TEXT NOT NULL,
    is_organic INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_week ON messages (chat_id, week_of);
