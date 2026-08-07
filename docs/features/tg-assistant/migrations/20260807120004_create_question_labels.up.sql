CREATE TABLE IF NOT EXISTS question_labels (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id),
    label VARCHAR(32) NOT NULL,
    rule_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id)
);
