import { describe, expect, it } from 'vitest';
import { calcZlecenie } from '../scenarios/zlecenie';
import { getParams } from '@/lib/rules/types';
import { baseAnswers, withAnswers } from './fixtures';

/**
 * Гілки, які змінюють висновок (правило testing.md — не «щасливий шлях»):
 * добровільна хворобова, збіг титулів із етатом, доступність 50% KUP і його
 * річний ліміт. Еталонні числа — у benchmark.test.ts, тут перевіряється сама
 * розвилка.
 */
describe('zlecenie — добровільна хворобова', () => {
  it('без хворобової на руки БІЛЬШЕ, ніж із нею — і це підписано приміткою', () => {
    const withSickness = calcZlecenie(baseAnswers);
    const without = calcZlecenie(withAnswers({ voluntarySickness: false }));

    expect(without.rangeMonthly!.min).toBeGreaterThan(withSickness.rangeMonthly!.min);
    expect(without.noteKeys).toContain('zlecenie.choroboweSkipped');
    expect(withSickness.noteKeys).toContain('zlecenie.choroboweIncluded');
  });
});

describe('zlecenie — збіг титулів із паралельним етатом', () => {
  const zbieg = calcZlecenie(withAnswers({ hasParallelUop: true }));

  it('społeczne не нараховуються, тож на руки помітно більше', () => {
    expect(zbieg.rangeMonthly!.min).toBeGreaterThan(calcZlecenie(baseAnswers).rangeMonthly!.max);
    expect(zbieg.noteKeys).toContain('zlecenie.zbieg');
  });

  // Медичний внесок обов'язковий з КОЖНОГО титулу — якби збіг знімав і його,
  // цифра була б ще вищою. Тест ловить саме цю помилку.
  it('zdrowotna 9% лишається: на руки менше за «нуль внесків» від тієї ж виручки', () => {
    const noContributionsAtAll = 15000 - Math.max(0, 15000 * 12 * 0.8 * 0.12 - 3600) / 12;
    expect(zbieg.rangeMonthly!.max).toBeLessThan(noContributionsAtAll);
  });
});

describe('zlecenie — 50% KUP', () => {
  it('недоступне без утвору (не-IT робота), із поясненням чому', () => {
    const nonIt = calcZlecenie(withAnswers({ workKind: 'nonIt' }));
    const kup50 = nonIt.subforms!.find((s) => s.id === 'kup50')!;

    expect(kup50.available).toBe(false);
    expect(kup50.rangeMonthly).toBeNull();
    expect(kup50.unavailableReasonKey).toBe('zlecenie.noCopyrightWork');
  });

  it('доступне при програмуванні і дає більше на руки, ніж 20%', () => {
    const s = calcZlecenie(baseAnswers);
    const kup20 = s.subforms!.find((sub) => sub.id === 'kup20')!;
    const kup50 = s.subforms!.find((sub) => sub.id === 'kup50')!;

    expect(kup50.available).toBe(true);
    expect(kup50.rangeMonthly!.min).toBeGreaterThan(kup20.rangeMonthly!.min);
  });

  /**
   * Ліміт 120,000 zł/рік мусить різати арифметику, а не лише підписуватись
   * приміткою. Перша версія цього тесту порівнювала «менше за грубу оцінку» — і
   * мутація «ліміт знято» її проходила. Тому тут — точне число, виведене вручну:
   * виручка 40,000 → прихід 33,200.53/міс (÷1.2048) → річний 398,406.37;
   * społeczne 41,581.72 (база emerytalne+rentowe вперлась у 282,600); база KUP
   * 356,824.66; 50% від неї = 178,412.33 > ліміту, тож KUP = рівно 120,000 →
   * дохід 236,824.66 → PIT 48,183.89 → на руки 23,043.88.
   */
  it('річний ліміт 120,000 zł застосовується в арифметиці, не тільки в примітці', () => {
    const cap = getParams<{ copyrightAnnualCap: number }>('zlecenie.kup').copyrightAnnualCap;
    const rich = calcZlecenie(withAnswers({ monthlyRevenue: 40000 }));
    const kup50 = rich.subforms!.find((s) => s.id === 'kup50')!;
    const center = (r: { min: number; max: number }) => (r.min + r.max) / 2;

    expect(cap).toBe(120000);
    expect(rich.noteKeys).toContain('zlecenie.copyrightCapExceeded');
    expect(center(kup50.rangeMonthly!)).toBeCloseTo(23043.88, 2);
  });
});

describe('zlecenie — рамка сценарію', () => {
  const s = calcZlecenie(baseAnswers);

  it('ризик жовтий саме через перекваліфікацію PIP, а не через податки', () => {
    expect(s.risk).toBe('yellow');
    expect(s.riskReasonKey).toBe('risk.zlecenie.reclassification');
    expect(s.sources.map((src) => src.ruleId)).toContain('zlecenie.przekwalifikowanie');
  });

  it('випадок студента до 26 років названий приміткою, бо анкета віку не питає', () => {
    expect(s.noteKeys).toContain('zlecenie.studentUnder26');
  });

  it('база порівняння — повний кошт замовника, як в UoP', () => {
    expect(s.noteKeys).toContain('uop.employerCostBasis');
    expect(calcZlecenie(baseAnswers, 'gross').rangeMonthly!.min).toBeGreaterThan(s.rangeMonthly!.min);
  });
});
