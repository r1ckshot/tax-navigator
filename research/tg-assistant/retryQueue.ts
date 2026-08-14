export interface FloodWaitAttempt {
  floodWaitSeconds: number;
}

export interface RetryOutcome {
  action: 'retry' | 'dead_letter';
  waitMs: number | null;
  reason: string | null;
}

export function decideChatRetry(
  priorAttempts: readonly FloodWaitAttempt[],
  currentFloodWaitSeconds: number
): RetryOutcome {
  const attemptNumber = priorAttempts.length + 1;

  if (attemptNumber >= 3) {
    return {
      action: 'dead_letter',
      waitMs: null,
      reason: `Chat exhausted after ${attemptNumber} consecutive FLOOD_WAIT retries (last FLOOD_WAIT_X=${currentFloodWaitSeconds}s)`,
    };
  }

  return { action: 'retry', waitMs: currentFloodWaitSeconds * 1000, reason: null };
}
