import type { Range } from './types';

/**
 * Правило product-safety: «діапазони, не точні суми». Точна арифметика ніколи
 * не показується як одне число.
 *
 * Ширина смуги різна за природою невизначеності:
 * - ARITHMETIC — сценарії, порахованi зі звірених ставок (JDG, UoP). Лишається
 *   похибка припущень анкети (пороги zdrowotna по річній базі, місяць старту).
 * - ESTIMATE — сценарії, де саме джерело називає цифру оцінкою (інкубатор:
 *   EVIDENCE §6 «еф. ставки лишаються ОЦІНКОЮ»).
 */
export const UNCERTAINTY = {
  ARITHMETIC: 0.04,
  ESTIMATE: 0.1,
} as const;

export function toRange(exact: number, uncertainty: number = UNCERTAINTY.ARITHMETIC): Range {
  const spread = Math.abs(exact) * uncertainty;
  return {
    min: round2(exact - spread),
    max: round2(exact + spread),
  };
}

/**
 * Округлення до копійки. Наївний `Math.round(value * 100) / 100` тут помиляється
 * на грош: рівно-половинні значення після ланцюжка ділень лежать у памʼяті трохи
 * НИЖЧЕ половини (120,199.98 / 12 = 10,016.665 у двійковому float — це
 * 10016.664999999999), і половинка губиться вниз замість вгору. Знайдено при
 * переїзді еталонів UoP на центр смуги: рахунок вручну давав 10,016.67, движок —
 * 10,016.66. Гасимо шум на шостому знаку, аж тоді округлюємо.
 */
export function round2(value: number): number {
  return Math.round(Number((value * 100).toFixed(6))) / 100;
}

export function rangeContains(range: Range, value: number): boolean {
  return value >= range.min && value <= range.max;
}
