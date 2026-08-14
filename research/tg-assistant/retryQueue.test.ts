import { describe, expect, it } from 'vitest';
import { decideChatRetry } from './retryQueue';

describe('decideChatRetry — AC-08', () => {
  it('AC-08.1: без попередніх спроб — retry, waitMs = X*1000', () => {
    const result = decideChatRetry([], 30);
    expect(result).toEqual({ action: 'retry', waitMs: 30000, reason: null });
  });

  it('AC-08.2: 1 попередня невдала спроба — усе ще retry', () => {
    const result = decideChatRetry([{ floodWaitSeconds: 30 }], 60);
    expect(result.action).toBe('retry');
    expect(result.waitMs).toBe(60000);
  });

  it('AC-08.3: 2 попередні невдалі спроби (3-тя зараз) — dead_letter, waitMs=null, reason непорожній', () => {
    const priorAttempts = [{ floodWaitSeconds: 30 }, { floodWaitSeconds: 60 }];
    const result = decideChatRetry(priorAttempts, 90);

    expect(result.action).toBe('dead_letter');
    expect(result.waitMs).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it('AC-08.4: dead_letter reason називає кількість спроб і останній X, не generic "failed"', () => {
    const priorAttempts = [{ floodWaitSeconds: 30 }, { floodWaitSeconds: 60 }];
    const result = decideChatRetry(priorAttempts, 90);

    expect(result.reason).not.toBe('failed');
    expect(result.reason).not.toBe('error');
    expect(result.reason).toMatch(/3/);
    expect(result.reason).toMatch(/90/);
  });

  it('AC-08.5: великий floodWaitSeconds (21600 = 6 год), 0 попередніх спроб — усе одно retry', () => {
    const result = decideChatRetry([], 21600);
    expect(result.action).toBe('retry');
  });
});
