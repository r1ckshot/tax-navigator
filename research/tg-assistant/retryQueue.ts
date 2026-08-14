/**
 * Per-chat FLOOD_WAIT retry decision (ADR-0002, AC-08).
 *
 * Pure-function частина per-chat backoff черги: сама MTProto-черга (реальні
 * мережеві виклики) залишається поза скоупом — тут лише рішення "retry чи
 * dead-letter" для одного чату на основі історії його попередніх спроб.
 */

export interface FloodWaitAttempt {
  floodWaitSeconds: number; // X із помилки Telegram FLOOD_WAIT_X
}

export interface RetryOutcome {
  action: 'retry' | 'dead_letter';
  waitMs: number | null; // присутнє лише при action === 'retry'
  reason: string | null; // присутнє лише при action === 'dead_letter'
}

/** Чат вичерпав ліміт спроб для цього номера спроби (ADR-0002: поріг = 3 поспіль). */
function isAttemptExhausted(attemptNumber: number): boolean {
  return attemptNumber >= 3;
}

/** Людинозрозуміла причина dead-letter: скільки спроб і яким був останній FLOOD_WAIT_X. */
function buildDeadLetterReason(
  attemptNumber: number,
  currentFloodWaitSeconds: number
): string {
  return `Chat exhausted after ${attemptNumber} consecutive FLOOD_WAIT retries (last FLOOD_WAIT_X=${currentFloodWaitSeconds}s); moving to dead letter queue`;
}

export function decideChatRetry(
  priorAttempts: readonly FloodWaitAttempt[],
  currentFloodWaitSeconds: number
): RetryOutcome {
  const attemptNumber = priorAttempts.length + 1;

  if (isAttemptExhausted(attemptNumber)) {
    return {
      action: 'dead_letter',
      waitMs: null,
      reason: buildDeadLetterReason(attemptNumber, currentFloodWaitSeconds),
    };
  }

  return {
    action: 'retry',
    waitMs: currentFloodWaitSeconds * 1000,
    reason: null,
  };
}
