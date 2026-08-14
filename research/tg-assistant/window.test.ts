import { describe, expect, it } from 'vitest';
import { applyBackfillWindow } from './window';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const NOW = '2026-08-14T00:00:00.000Z';
const nowMs = new Date(NOW).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('applyBackfillWindow — AC-10', () => {
  it('AC-10.1: чат старший за вікно — повідомлення до межі відкидаються, на межі й новіші лишаються', () => {
    const chatCreatedAt = iso(nowMs - 10 * WEEK); // чат на 10 тижнів старший за now
    const messages = [
      { telegramMessageId: 1, postedAt: iso(nowMs - 6 * WEEK) }, // до межі (вікно = 4 тижні)
      { telegramMessageId: 2, postedAt: iso(nowMs - 3 * WEEK) }, // після межі
      { telegramMessageId: 3, postedAt: iso(nowMs - 1 * DAY) },
    ];

    const result = applyBackfillWindow({ chatCreatedAt, now: NOW, windowWeeks: 4, messages });

    expect(result.messages.map((m) => m.telegramMessageId)).toEqual([2, 3]);
  });

  it('AC-10.2: чат молодший за вікно — вікно не застосовується, усі повідомлення лишаються як є', () => {
    const chatCreatedAt = iso(nowMs - 2 * WEEK); // молодший за вікно (4 тижні)
    const messages = [
      { telegramMessageId: 1, postedAt: iso(nowMs - 2 * WEEK) },
      { telegramMessageId: 2, postedAt: iso(nowMs - 1 * DAY) },
    ];

    const result = applyBackfillWindow({ chatCreatedAt, now: NOW, windowWeeks: 4, messages });

    expect(result.windowApplied).toBe(false);
    expect(result.windowStartAt).toBeNull();
    expect(result.messages.map((m) => m.telegramMessageId)).toEqual([1, 2]);
  });

  it('AC-10.3: межа вікна включна — повідомлення рівно на windowStartAt лишається', () => {
    const chatCreatedAt = iso(nowMs - 10 * WEEK);
    const windowStartAt = nowMs - 4 * WEEK;
    const messages = [{ telegramMessageId: 1, postedAt: iso(windowStartAt) }];

    const result = applyBackfillWindow({ chatCreatedAt, now: NOW, windowWeeks: 4, messages });

    expect(result.messages.map((m) => m.telegramMessageId)).toEqual([1]);
  });

  it('AC-10.4: повідомлення на 1мс раніше за межу відкидається', () => {
    const chatCreatedAt = iso(nowMs - 10 * WEEK);
    const windowStartAt = nowMs - 4 * WEEK;
    const messages = [{ telegramMessageId: 1, postedAt: iso(windowStartAt - 1) }];

    const result = applyBackfillWindow({ chatCreatedAt, now: NOW, windowWeeks: 4, messages });

    expect(result.messages).toEqual([]);
  });

  it('AC-10.5: коли вікно застосовано, windowStartAt у відповіді — точна межа (now - N тижнів), не null', () => {
    const chatCreatedAt = iso(nowMs - 10 * WEEK);

    const result = applyBackfillWindow({ chatCreatedAt, now: NOW, windowWeeks: 4, messages: [] });

    expect(result.windowApplied).toBe(true);
    expect(result.windowStartAt).toBe(iso(nowMs - 4 * WEEK));
  });

  it('AC-10.6: порожній список повідомлень — вікно все одно позначене явно (не залежить від кількості даних)', () => {
    const chatCreatedAt = iso(nowMs - 10 * WEEK);

    const result = applyBackfillWindow({ chatCreatedAt, now: NOW, windowWeeks: 4, messages: [] });

    expect(result.messages).toEqual([]);
    expect(result.windowApplied).toBe(true);
    expect(result.windowStartAt).not.toBeNull();
  });
});
