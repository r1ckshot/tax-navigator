import { describe, expect, it } from 'vitest';
import { quantizeRevenue, snapToStep, REVENUE_MIN, REVENUE_MAX, REVENUE_STEP } from '../quantize';
import { SCREENS } from '@/lib/questions/schema';

/**
 * Квантизація виручки — правило приватності, а не деталь UI: застосунок ніколи
 * не бачить числа точнішого за 2 500 zł. Раніше те саме округлення жило у двох
 * незалежних реалізаціях (share.ts і слайдер у Question.tsx) з різними джерелами
 * меж. Ці тести існують, щоб копії не з'явились знову непоміченими.
 */
describe('quantizeRevenue — крок 2 500', () => {
  it('нижче мінімуму → мінімум', () => {
    expect(quantizeRevenue(1)).toBe(2500);
  });

  it('поріг zdrowotnej 5 000/міс лягає рівно на крок', () => {
    expect(quantizeRevenue(5000)).toBe(5000);
  });

  it('другий поріг zdrowotnej 25 000/міс теж на кроці', () => {
    expect(quantizeRevenue(25000)).toBe(25000);
  });

  it('округлює до найближчого кроку, а не вниз: 6000 → 5000, 6300 → 7500', () => {
    expect(quantizeRevenue(6000)).toBe(5000);
    expect(quantizeRevenue(6300)).toBe(7500);
  });

  it('вище максимуму → максимум', () => {
    expect(quantizeRevenue(999999)).toBe(50000);
  });

  it('нечислове → мінімум, а не NaN', () => {
    expect(quantizeRevenue(Number.NaN)).toBe(REVENUE_MIN);
    expect(quantizeRevenue(Number.POSITIVE_INFINITY)).toBe(REVENUE_MIN);
  });
});

describe('слайдер виручки і квантизація не розходяться', () => {
  const revenueSlider = SCREENS.flatMap((s) => s.fields).find(
    (f) => f.name === 'monthlyRevenue',
  )?.slider;

  it('слайдер виручки існує і взятий саме зі схеми анкети', () => {
    expect(revenueSlider).toBeDefined();
  });

  it('межі й крок слайдера — ті самі константи, що й у квантизації', () => {
    expect(revenueSlider!.min).toBe(REVENUE_MIN);
    expect(revenueSlider!.max).toBe(REVENUE_MAX);
    expect(revenueSlider!.step).toBe(REVENUE_STEP);
  });

  it('snapToStep на конфізі слайдера дає те саме, що quantizeRevenue', () => {
    const cfg = revenueSlider!;
    const scale = { min: cfg.min, max: cfg.max, step: cfg.step, fallback: REVENUE_MIN };
    for (const v of [1, 2500, 6000, 6300, 15000, 17342, 25000, 49999, 999999]) {
      expect(snapToStep(v, scale)).toBe(quantizeRevenue(v));
    }
  });

  it('fallback навмисно різний: сховище падає на мінімум, слайдер — на стартове значення', () => {
    // Не розбіжність, а різні контексти: порожнє сховище не має права вигадати
    // користувачу дохід 15 000, а слайдер мусить десь стояти.
    const cfg = revenueSlider!;
    expect(quantizeRevenue(Number.NaN)).toBe(REVENUE_MIN);
    expect(snapToStep(Number.NaN, { ...cfg, fallback: cfg.default })).toBe(cfg.default);
    expect(cfg.default).not.toBe(REVENUE_MIN);
  });
});
