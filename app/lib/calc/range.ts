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

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function rangeContains(range: Range, value: number): boolean {
  return value >= range.min && value <= range.max;
}
