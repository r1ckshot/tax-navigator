/**
 * Per-chat FLOOD_WAIT retry decision (ADR-0002, AC-08).
 *
 * Pure-function частина per-chat backoff черги: сама MTProto-черга (реальні
 * мережеві виклики) залишається поза скоупом — тут лише рішення "retry чи
 * dead-letter" для одного чату на основі історії його попередніх спроб.
 *
 * RED phase: реалізація навмисно відсутня, лише кидає помилку.
 */

export interface FloodWaitAttempt {
  floodWaitSeconds: number; // X із помилки Telegram FLOOD_WAIT_X
}

export interface RetryOutcome {
  action: 'retry' | 'dead_letter';
  waitMs: number | null; // присутнє лише при action === 'retry'
  reason: string | null; // присутнє лише при action === 'dead_letter'
}

export function decideChatRetry(
  _priorAttempts: readonly FloodWaitAttempt[],
  _currentFloodWaitSeconds: number
): RetryOutcome {
  throw new Error('not implemented');
}
