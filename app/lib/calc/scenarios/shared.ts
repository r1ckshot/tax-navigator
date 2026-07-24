import type { ExpenseShare, Range, SubformResult } from '../types';

/** Середина заявленої користувачем смуги витрат. */
export function expenseRate(share: ExpenseShare): number {
  switch (share) {
    case 'lt10':
      return 0.05;
    case 'from10to30':
      return 0.2;
    case 'gt30':
      return 0.4;
  }
}

/**
 * Річний податок за скалею: 12% до порогу, 32% понад, мінус kwota zmniejszająca
 * (застосовується один раз, не щомісяця). Нижня межа — нуль.
 */
export function skalaAnnualTax(
  annualIncome: number,
  opts: { lowerRate: number; upperRate: number; bracketThreshold: number; kwotaZmniejszajacaAnnual: number }
): number {
  const lower = Math.min(annualIncome, opts.bracketThreshold);
  const upper = Math.max(0, annualIncome - opts.bracketThreshold);
  const tax = lower * opts.lowerRate + upper * opts.upperRate - opts.kwotaZmniejszajacaAnnual;
  return Math.max(0, tax);
}

/** Смуга, що покриває всі доступні підформи. */
export function spanOf(subforms: SubformResult[]): Range | null {
  const ranges = subforms.filter((s) => s.available && s.rangeMonthly).map((s) => s.rangeMonthly!);
  if (ranges.length === 0) return null;
  return {
    min: Math.min(...ranges.map((r) => r.min)),
    max: Math.max(...ranges.map((r) => r.max)),
  };
}
