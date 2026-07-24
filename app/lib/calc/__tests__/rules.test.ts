import { describe, expect, it } from 'vitest';
import { RULES, getParams } from '@/lib/rules/types';

describe('rules-as-data — дисципліна джерел', () => {
  it('кожне правило має source_url і verified_at', () => {
    for (const rule of RULES.rules) {
      expect(rule.source_url, rule.rule_id).toMatch(/^https?:\/\//);
      expect(rule.verified_at, rule.rule_id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('rule_id унікальні', () => {
    const ids = RULES.rules.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('податковий рік зафіксований на 2026', () => {
    expect(RULES.tax_year).toBe(2026);
  });
});

describe('verify-first числа не дрейфнули', () => {
  it('składka zdrowotna для ричалту — чинні пороги Polskiego Ładu', () => {
    const z = getParams<{ tiers: { monthly: number }[] }>('jdg.zdrowotna.ryczalt');
    expect(z.tiers.map((t) => t.monthly)).toEqual([498.35, 830.58, 1495.04]);
  });

  // STATE.md попереджає: у мережі гуляють цифри з ВЕТОВАНОЇ реформи 2025.
  // Якщо вони колись потраплять у дані — цей тест має впасти.
  it('АНТИ-РЕГРЕС: цифри ветованої реформи не потрапили в дані', () => {
    const serialized = JSON.stringify(RULES);
    for (const vetoed of [376.16, 626.93, 1128.48]) {
      expect(serialized).not.toContain(String(vetoed));
    }
  });

  it('етапи ZUS 2026', () => {
    const s = getParams<Record<string, number>>('jdg.zus.stages');
    expect(s.preferencyjnyWithSickness).toBe(456.18);
    expect(s.preferencyjnyWithoutSickness).toBe(420.86);
    expect(s.duzyMonthly).toBe(1926.76);
  });

  it('sunset спецнорми art. 52zr — 31.12.2026', () => {
    expect(getParams<{ validTo: string }>('residency.special_norm_52zr').validTo).toBe('2026-12-31');
  });

  it('внутрішня звірка: 30-krotność = 30 × прогнозована середня, що дає базу duży ZUS', () => {
    const avg = getParams<{ monthly: number }>('common.projected_average_wage').monthly;
    const cap = getParams<{ annualBaseCap: number }>('uop.annual_contribution_cap').annualBaseCap;
    const duzyBase = getParams<{ duzyBase: number }>('jdg.zus.stages').duzyBase;
    expect(cap).toBe(avg * 30);
    expect(duzyBase).toBeCloseTo(avg * 0.6, 0);
  });

  it('наріст роботодавця при UoP ≈ 20.48%', () => {
    const er = getParams<Record<string, number>>('uop.employer_contributions');
    const total = er.emerytalne + er.rentowe + er.wypadkowe + er.fpFs + er.fgsp;
    expect(total).toBeCloseTo(0.2048, 4);
  });

  it('społeczne працівника при UoP = 13.71%', () => {
    const ee = getParams<Record<string, number>>('uop.employee_contributions');
    expect(ee.emerytalne + ee.rentowe + ee.chorobowe).toBeCloseTo(0.1371, 4);
  });
});
