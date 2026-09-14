import { describe, expect, it } from 'vitest';
import { isCycleDue, isoWeek, scheduledMoment } from './schedule';

const MONDAY_6 = { weekday: 1, hourUtc: 6 };

describe('isoWeek', () => {
  // Еталони виведено вручну за ISO 8601: тиждень належить року свого четверга.
  it('1 січня 2026 — четвер, отже перший тиждень 2026', () => {
    expect(isoWeek(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
  });

  it('понеділок 29.12.2025 уже в 2026-W01 — його четвер 01.01.2026', () => {
    expect(isoWeek(new Date('2025-12-29T00:00:00Z'))).toBe('2026-W01');
  });

  it('п’ятниця 01.01.2027 — у 2026-W53: рік, що почався в четвер, має 53 тижні', () => {
    expect(isoWeek(new Date('2027-01-01T08:00:00Z'))).toBe('2026-W53');
  });

  it('понеділок 14.09.2026 — W38: 259 днів від понеділка 29.12.2025, 259 / 7 = 37 повних тижнів', () => {
    expect(isoWeek(new Date('2026-09-14T00:00:00Z'))).toBe('2026-W38');
  });

  it('межа тижня в UTC: неділя 23:59:59 ще W37', () => {
    expect(isoWeek(new Date('2026-09-13T23:59:59Z'))).toBe('2026-W37');
  });
});

describe('scheduledMoment', () => {
  it('понеділок 06:00 UTC того самого тижня, навіть коли now — субота', () => {
    expect(scheduledMoment(new Date('2026-09-19T20:00:00Z'), MONDAY_6).toISOString()).toBe(
      '2026-09-14T06:00:00.000Z'
    );
  });

  it('неділя 23:00 UTC — останній день ISO-тижня', () => {
    expect(scheduledMoment(new Date('2026-09-14T00:00:00Z'), { weekday: 7, hourUtc: 23 }).toISOString()).toBe(
      '2026-09-20T23:00:00.000Z'
    );
  });
});

describe('isCycleDue', () => {
  it('до моменту тижня — ще не належний', () => {
    expect(isCycleDue(new Date('2026-09-14T05:59:59Z'), MONDAY_6, false)).toBe(false);
  });

  it('рівно в момент — належний (межа включна)', () => {
    expect(isCycleDue(new Date('2026-09-14T06:00:00Z'), MONDAY_6, false)).toBe(true);
  });

  it('тиждень уже оброблено — не належний, хоч момент давно минув', () => {
    expect(isCycleDue(new Date('2026-09-18T10:00:00Z'), MONDAY_6, true)).toBe(false);
  });
});
