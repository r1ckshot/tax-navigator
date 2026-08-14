import { describe, expect, it } from 'vitest';
import { decideChatRetry, type FloodWaitAttempt } from './retryQueue';

describe('decideChatRetry — AC-08', () => {
  it('AC-08.1: без попередніх спроб — retry, waitMs = X * 1000', () => {
    const outcome = decideChatRetry([], 90);

    expect(outcome.action).toBe('retry');
    expect(outcome.waitMs).toBe(90 * 1000);
  });

  it('AC-08.2: 1 попередня невдала спроба — усе ще retry (2-га спроба не вичерпання)', () => {
    const priorAttempts: FloodWaitAttempt[] = [{ floodWaitSeconds: 30 }];

    const outcome = decideChatRetry(priorAttempts, 60);

    expect(outcome.action).toBe('retry');
  });

  it('AC-08.3: 2 попередні невдалі спроби (3-тя зараз) — dead_letter, waitMs = null, reason непорожній', () => {
    const priorAttempts: FloodWaitAttempt[] = [
      { floodWaitSeconds: 30 },
      { floodWaitSeconds: 45 },
    ];

    const outcome = decideChatRetry(priorAttempts, 60);

    expect(outcome.action).toBe('dead_letter');
    expect(outcome.waitMs).toBeNull();
    expect(outcome.reason).not.toBeNull();
    expect(outcome.reason).not.toBe('');
  });

  it('AC-08.4: reason у вичерпаному випадку явно містить кількість спроб і останній X, не generic "failed"/"error"', () => {
    const priorAttempts: FloodWaitAttempt[] = [
      { floodWaitSeconds: 30 },
      { floodWaitSeconds: 45 },
    ];

    const outcome = decideChatRetry(priorAttempts, 60);

    expect(outcome.reason).not.toBeNull();
    expect(outcome.reason?.toLowerCase()).not.toBe('failed');
    expect(outcome.reason?.toLowerCase()).not.toBe('error');
    expect(outcome.reason).toContain('3');
    expect(outcome.reason).toContain('60');
  });

  it('AC-08.5: великий floodWaitSeconds (21600 = 6 год) але 0 попередніх спроб — усе одно retry', () => {
    const outcome = decideChatRetry([], 21600);

    expect(outcome.action).toBe('retry');
    expect(outcome.waitMs).toBe(21600 * 1000);
  });
});
