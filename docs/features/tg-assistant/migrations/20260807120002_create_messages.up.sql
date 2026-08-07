CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id),
    telegram_message_id BIGINT NOT NULL,
    week_of VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    is_organic BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_week ON messages (chat_id, week_of);
