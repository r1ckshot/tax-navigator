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

export function applyBackfillWindow(_input: BackfillWindowInput): BackfillWindowResult {
  throw new Error('not implemented');
}
