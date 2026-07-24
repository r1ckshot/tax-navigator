import { describe, expect, it } from 'vitest';
import { calcJdg } from '../scenarios/jdg';
import { calcUop } from '../scenarios/uop';
import { calcIncubator } from '../scenarios/incubator';
import { calcFop } from '../scenarios/fop';
import { compareScenarios } from '../scenarios';
import { rangeContains } from '../range';
import { baseAnswers, withAnswers } from './fixtures';

/**
 * Еталони виведені вручну зі ставок, звірених у docs/EVIDENCE.md §6.
 * Профіль: виручка 15,000 zł/міс, повний ZUS (duży 1,926.76), програмування,
 * витрати <10% (беремо 5%).
 *
 * Це старт шляху до ворота G2 (10/10 профілів проти державних калькуляторів) —
 * тут закріплена арифметика, щоб рефактор не зсунув цифри непомітно.
 */
describe('benchmark — JDG при 15,000 zł/міс', () => {
  const jdg = calcJdg(baseAnswers);
  const sub = (id: string) => jdg.subforms?.find((s) => s.id === id);

  it('ричалт 12%: 15000 − 1750.17 податку − 830.58 zdrowotnej − 1926.76 ZUS = 10492.49', () => {
    expect(sub('ryczalt')!.rangeMonthly!).toBeDefined();
    expect(rangeContains(sub('ryczalt')!.rangeMonthly!, 10492.49)).toBe(true);
  });

  it('лінійний 19%: дохід 12323.24 після витрат і ZUS → на руки 9492.72', () => {
    expect(rangeContains(sub('liniowy')!.rangeMonthly!, 9492.72)).toBe(true);
  });

  it('скаля: 32% вмикається, бо річний дохід 147.9k > 120k → на руки 9570.71', () => {
    expect(rangeContains(sub('skala')!.rangeMonthly!, 9570.71)).toBe(true);
  });

  it('ричалт вигідніший за лінійний при витратах <10% (як каже EVIDENCE)', () => {
    expect(sub('ryczalt')!.rangeMonthly!.min).toBeGreaterThan(sub('liniowy')!.rangeMonthly!.min);
  });

  it('смуга ричалту перетинається з калібрувальною 10.5–11.2k з EVIDENCE', () => {
    const r = sub('ryczalt')!.rangeMonthly!;
    expect(r.max).toBeGreaterThanOrEqual(10500);
    expect(r.min).toBeLessThanOrEqual(11200);
  });
});

describe('benchmark — UoP', () => {
  it('база «повний кошт роботодавця»: брутто 12450.20 → на руки 8718.53', () => {
    const r = calcUop(baseAnswers, 'employerCost').rangeMonthly!;
    expect(rangeContains(r, 8718.53)).toBe(true);
  });

  it('база «брутто» (лише для звірки з EVIDENCE): 15000 брутто → на руки 10016.67', () => {
    const r = calcUop(baseAnswers, 'gross').rangeMonthly!;
    expect(rangeContains(r, 10016.67)).toBe(true);
  });

  it('30-krotność обмежує базу emerytalne+rentowe при високій зарплаті', () => {
    // 60,000 брутто/міс = 720,000/рік, але база emerytalne+rentowe стоїть на
    // 282,600. Звідси: pension 31,820.76 + chorobowe 17,640 = społeczne 49,460.76;
    // zdrowotna 60,348.53; PIT 186,012.56 → на руки 35,348.18/міс.
    // Без ліміту społeczne були б ~98,712 і цифра вийшла б суттєво нижчою,
    // тому точний збіг і є доказом, що ліміт застосовано.
    const r = calcUop(withAnswers({ monthlyRevenue: 60000 }), 'gross').rangeMonthly!;
    expect(rangeContains(r, 35348.18)).toBe(true);
  });
});

describe('benchmark — інкубатор', () => {
  const inc = calcIncubator(baseAnswers);

  it('KUP 20%: 15000 × (1 − 13.6%) − 324.5 абонемент = 12635.50', () => {
    const kup20 = inc.subforms!.find((s) => s.id === 'kup20')!;
    expect(rangeContains(kup20.rangeMonthly!, 12635.5)).toBe(true);
  });

  it('маркується як оцінка і як «без ZUS»', () => {
    expect(inc.noteKeys).toContain('incubator.isEstimate');
    expect(inc.noteKeys).toContain('incubator.noZus');
  });

  it('смуга ширша за арифметичні сценарії, бо джерело саме зве цифру оцінкою', () => {
    const kup20 = inc.subforms!.find((s) => s.id === 'kup20')!.rangeMonthly!;
    const jdgRyczalt = calcJdg(baseAnswers).subforms!.find((s) => s.id === 'ryczalt')!.rangeMonthly!;
    const width = (r: { min: number; max: number }) => (r.max - r.min) / ((r.max + r.min) / 2);
    expect(width(kup20)).toBeGreaterThan(width(jdgRyczalt));
  });
});

describe('ФОП — свідомо без числа', () => {
  it('діапазону немає, бо ЄСВ/ВЗ не звірені', () => {
    const fop = calcFop(baseAnswers);
    expect(fop.rangeMonthly).toBeNull();
    expect(fop.risk).toBe('red');
    expect(fop.noteKeys).toContain('fop.noNumericRange');
  });
});

describe('порівняння як ціле', () => {
  it('чотири сценарії у фіксованому порядку, без сортування «за вигодою»', () => {
    expect(compareScenarios(baseAnswers).map((s) => s.id)).toEqual(['fop', 'jdg', 'incubator', 'uop']);
  });

  it('кожен сценарій несе джерела для цитати', () => {
    for (const s of compareScenarios(baseAnswers)) {
      expect(s.sources.length).toBeGreaterThan(0);
    }
  });

  it('паралельний етат помітно піднімає JDG (społeczne = 0)', () => {
    const without = calcJdg(baseAnswers).rangeMonthly!;
    const withUop = calcJdg(withAnswers({ hasParallelUop: true })).rangeMonthly!;
    expect(withUop.max).toBeGreaterThan(without.max);
  });
});
