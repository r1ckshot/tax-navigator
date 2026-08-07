CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY,
    telegram_chat_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (telegram_chat_id)
);
