import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, buildSourceCatalog } from '../sources';
import { RULES, type Rule } from '../rules/types';

const TODAY = new Date('2026-09-15T12:00:00Z');

describe('buildSourceCatalog: поточний файл правил', () => {
  const catalog = buildSourceCatalog(TODAY);

  it('усі 30 правил потрапляють на сторінку, жодне не губиться', () => {
    expect(catalog.ruleCount).toBe(30);
    expect(catalog.groups.flatMap((g) => g.entries)).toHaveLength(RULES.rules.length);
  });

  // Еталон перелічено руками з rules.2026.json (перший сегмент rule_id).
  // status — правила права працювати (сесія 05 ROADMAP, 2026-10-03), на полотні
  // їх ще немає; jdg виросла на jdg.przekwalifikowanie.
  it('9 груп у фіксованому порядку', () => {
    expect(catalog.groups.map((g) => [g.id, g.entries.length])).toEqual([
      ['residency', 3],
      ['status', 3],
      ['common', 2],
      ['fop', 2],
      ['jdg', 7],
      ['incubator', 1],
      ['nierejestrowana', 4],
      ['zlecenie', 4],
      ['uop', 4],
    ]);
  });

  it('кожен запис несе джерело й дату з правила, хост узято з source_url', () => {
    for (const entry of catalog.groups.flatMap((g) => g.entries)) {
      const rule = RULES.rules.find((r) => r.rule_id === entry.ruleId)!;
      expect(entry.url).toBe(rule.source_url);
      expect(entry.verifiedAt).toBe(rule.verified_at);
      expect(entry.host).toBe(new URL(rule.source_url).hostname);
    }
  });

  it('на 2026-09-15 давніх правил немає', () => {
    expect(catalog.staleCount).toBe(0);
  });

  // Еталон виводиться з матриці, а не записаний числом: бот автозвірки щомісяця
  // рухає verified_at, і записане «10 правил від 2026-07-18» падало б на кожному
  // його PR. На 91-шу добу після найстарішої дати давніми стають рівно правила з
  // цією датою — решта звірена пізніше. Саму межу 90/91 тримає freshness.test.ts.
  it('на 91-шу добу після найстарішої звірки давніми стають рівно правила з тією датою', () => {
    const oldest = RULES.rules.map((r) => r.verified_at).sort()[0];
    const withOldest = RULES.rules.filter((r) => r.verified_at === oldest).length;
    const day91 = new Date(Date.parse(`${oldest}T12:00:00Z`) + 91 * 86_400_000);
    const later = buildSourceCatalog(day91);
    expect(withOldest).toBeGreaterThan(0);
    expect(later.staleCount).toBe(withOldest);
    const staleDates = new Set(later.groups.flatMap((g) => g.entries.filter((e) => e.stale).map((e) => e.verifiedAt)));
    expect([...staleDates]).toEqual([oldest]);
  });
});

describe('buildSourceCatalog: розвилки', () => {
  const rule = (rule_id: string): Rule => ({
    rule_id,
    params: {},
    source_url: 'https://www.zus.pl/x',
    verified_at: '2026-07-18',
  });

  it('правило з групою поза порядком падає, а не зникає зі сторінки', () => {
    expect(() => buildSourceCatalog(TODAY, [rule('vat.rate')])).toThrow(/vat\.rate/);
  });

  it('група без правил не показується порожньою карткою', () => {
    const catalog = buildSourceCatalog(TODAY, [rule('jdg.a'), rule('uop.b')]);
    expect(catalog.groups.map((g) => g.id)).toEqual(['jdg', 'uop']);
  });

  it('порядок груп покриває всі префікси поточного файла правил', () => {
    const prefixes = new Set(RULES.rules.map((r) => r.rule_id.split('.')[0]));
    expect([...prefixes].every((p) => (GROUP_ORDER as readonly string[]).includes(p))).toBe(true);
  });
});
