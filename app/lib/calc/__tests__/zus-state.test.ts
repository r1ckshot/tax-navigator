import { describe, expect, it } from 'vitest';
import { getParams } from '@/lib/rules/types';
import fixture from './zus-state-benchmark.json';

/**
 * Ворота G2, половина «складки»: наші параметри звіряються з відповідями
 * ДЕРЖАВНОГО калькулятора ZUS, а не з нашим же розумінням норми.
 *
 * Мережі тут немає свідомо — фікстуру перезбирає `node scripts/fetch-zus-benchmark.mjs`,
 * і вона несе `source_url` + `fetched_at`. Тест лишається детермінованим, а
 * держава лишається зовнішнім еталоном: розбіжність означає, що хтось із двох
 * помиляється, і треба знайти хто, а не правити фікстуру.
 *
 * Друга половина ворота (PIT) держкалькулятора не має — його виводять вручну з
 * норми в `benchmark.test.ts`. Межа між двома еталонами описана в docs/STATE.md.
 */

interface ZdrowotnaRyczaltParams {
  tiers: { annualRevenueUpTo: number | null; monthly: number }[];
}
interface ZdrowotnaIncomeParams {
  zdrowotnaRate: number;
  zdrowotnaMinMonthly: number;
}

type Case = (typeof fixture.cases)[number];

/** Ярус за приходом наростаючим підсумком; верхня межа ВКЛЮЧНА (art. 81 ust. 2e). */
function tierMonthly(annualRevenue: number): number {
  const { tiers } = getParams<ZdrowotnaRyczaltParams>('jdg.zdrowotna.ryczalt');
  const tier = tiers.find((t) => t.annualRevenueUpTo === null || annualRevenue <= t.annualRevenueUpTo);
  return tier!.monthly;
}

function ourAnswer(c: Case): number {
  if (c.form === 'lump') return tierMonthly(c.annualRevenue!);
  const p = getParams<ZdrowotnaIncomeParams>(c.form === 'flat' ? 'jdg.liniowy' : 'jdg.skala');
  return Math.max(p.zdrowotnaRate * c.monthlyIncome!, p.zdrowotnaMinMonthly);
}

describe(`складка zdrowotna проти калькулятора ZUS (${fixture.fetched_at})`, () => {
  it('фікстура несе джерело, дату і рік, за який рахувала держава', () => {
    expect(fixture.source_url).toContain('zus.pl');
    expect(fixture.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fixture.period.year).toBe('2026');
  });

  // Січень 2026 має ІНШУ мінімальну базу (складка 314.96 замість 432.54) — на
  // ньому кейси `.min` зійшлися б з іншим числом і нічого б не довели.
  it('держава рахувала не за січень, інакше мінімум був би інший', () => {
    expect(Number(fixture.period.month)).toBeGreaterThan(1);
  });

  it.each(fixture.cases)('$id — $note: держава каже $monthlyContribution zł', (c) => {
    expect(ourAnswer(c)).toBeCloseTo(c.monthlyContribution, 2);
  });

  // Пороги ярусів перевіряються парами, бо помилка «>» замість «>=» видно лише
  // на самій межі: 60,000 держава лишає в нижньому ярусі, 60,000.01 — уже ні.
  it('верхні межі ярусів включні — доведено парами навколо 60k і 300k', () => {
    const at = (id: string) => fixture.cases.find((c) => c.id === id)!.monthlyContribution;
    expect(at('ryczalt.tier1.edge')).toBe(at('ryczalt.tier1.mid'));
    expect(at('ryczalt.tier2.low')).toBeGreaterThan(at('ryczalt.tier1.edge'));
    expect(at('ryczalt.tier2.edge')).toBe(at('ryczalt.tier2.mid'));
    expect(at('ryczalt.tier3.low')).toBeGreaterThan(at('ryczalt.tier2.edge'));
  });
});
