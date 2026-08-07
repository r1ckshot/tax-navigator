CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    telegram_chat_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (telegram_chat_id)
);
