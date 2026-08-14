export interface BackfillMessage {
  telegramMessageId: number;
  postedAt: string;
}

export interface BackfillWindowInput {
  chatCreatedAt: string;
  now: string;
  windowWeeks: number;
  messages: readonly BackfillMessage[];
}

export interface BackfillWindowResult {
  messages: BackfillMessage[];
  windowApplied: boolean;
  windowStartAt: string | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function applyBackfillWindow(input: BackfillWindowInput): BackfillWindowResult {
  const windowStartMs = new Date(input.now).getTime() - input.windowWeeks * WEEK_MS;
  const chatCreatedMs = new Date(input.chatCreatedAt).getTime();

  if (chatCreatedMs >= windowStartMs) {
    return { messages: [...input.messages], windowApplied: false, windowStartAt: null };
  }

  const windowStartAt = new Date(windowStartMs).toISOString();
  const messages = input.messages.filter((m) => new Date(m.postedAt).getTime() >= windowStartMs);

  return { messages, windowApplied: true, windowStartAt };
}
