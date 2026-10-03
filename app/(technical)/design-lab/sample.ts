import type { Answers } from '@/lib/calc/types';
import { assessResidency } from '@/lib/calc/residency';
import { compareScenarios } from '@/lib/calc/scenarios';

/**
 * Профіль прикладу для фрагмента результату: той самий, що в еталонах G2
 * (`calc/__tests__/fixtures.ts`), — резидент PL, IT-B2B, 15 000 zł/міс, статус
 * UKR. Тестові фікстури сторінка не імпортує, тож профіль повторено тут; числа
 * рахує `calc/`, а не ця сторінка.
 */
export const SAMPLE_ANSWERS: Answers = {
  stayBasis: 'ukr',
  daysInPl: 'gte183',
  personalCenter: 'PL',
  economicCenter: 'PL',
  specialLaw52zr: 'no',
  incomeSource: 'plClients',
  permanentHomeInUa: false,
  hasActiveUaFop: false,
  monthlyRevenue: 15000,
  workKind: 'programming',
  expenseShare: 'lt10',
  hasParallelUop: false,
  formerEmployer: 'no',
  jdgStatus: 'gt30',
  hadJdgInLast60Months: false,
  voluntarySickness: true,
  clientCount: 'several',
};

/** Розрахунок прикладу — той самий виклик `calc/`, що й на екрані результату. */
export function sampleResult() {
  return { residency: assessResidency(SAMPLE_ANSWERS), scenarios: compareScenarios(SAMPLE_ANSWERS) };
}
