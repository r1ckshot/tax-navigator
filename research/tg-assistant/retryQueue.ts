export interface FloodWaitAttempt {
  floodWaitSeconds: number;
}

export interface RetryOutcome {
  action: 'retry' | 'dead_letter';
  waitMs: number | null;
  reason: string | null;
}

export function decideChatRetry(
  _priorAttempts: readonly FloodWaitAttempt[],
  _currentFloodWaitSeconds: number
): RetryOutcome {
  throw new Error('not implemented');
}
