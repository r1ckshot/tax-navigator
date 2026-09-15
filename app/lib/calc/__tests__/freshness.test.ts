import { describe, expect, it } from 'vitest';
import { RULES } from '../../rules/types';
import { STALE_AFTER_DAYS, ageInDays, isStale } from '../freshness';
// Скрипт хука — друга реалізація того самого порогу. Тест тримає, що вони не
// розійдуться: імпортувати його в сам calc/ шари не дозволяють.
import { getStaleRules } from '../../../../scripts/check-stale-rules.mjs';

describe('freshness: межа порогу', () => {
  // Еталон руками: 2026-07-18 + 90 діб = 2026-10-16, отже 16.10 ще свіже,
  // 17.10 уже ні (поріг строгий, `>`).
  it('90-та доба ще свіжа, 91-ша вже давня', () => {
    expect(ageInDays('2026-07-18', new Date('2026-10-16T00:00:00Z'))).toBe(90);
    expect(isStale('2026-07-18', new Date('2026-10-16T23:59:59Z'))).toBe(false);
    expect(isStale('2026-07-18', new Date('2026-10-17T00:00:00Z'))).toBe(true);
  });

  it('поріг за замовчуванням 90 днів, як у скрипті хука', () => {
    expect(STALE_AFTER_DAYS).toBe(90);
  });

  it('кривий verified_at падає, а не мовчки стає свіжим', () => {
    expect(() => isStale('18.07.2026', new Date())).toThrow(/Invalid verified_at/);
  });
});

describe('freshness: збіг зі scripts/check-stale-rules.mjs', () => {
  // Дати навколо кожної межі в поточному файлі правил плюс далекі точки.
  const NOW = ['2026-09-15', '2026-10-16', '2026-10-17', '2026-10-22', '2026-10-27', '2026-11-01', '2027-06-01'];

  it.each(NOW)('на %s обидві реалізації називають ті самі правила', (day) => {
    const now = new Date(`${day}T12:00:00Z`);
    const fromScript = getStaleRules(STALE_AFTER_DAYS, now)
      .map((r: { rule_id: string }) => r.rule_id)
      .sort();
    const fromCalc = RULES.rules
      .filter((r) => isStale(r.verified_at, now))
      .map((r) => r.rule_id)
      .sort();
    expect(fromCalc).toEqual(fromScript);
  });
});
