import type { Answers } from '../types';

/** Базовий профіль: IT-B2B, резидент PL, повний ZUS, виручка 15,000 zł/міс. */
export const baseAnswers: Answers = {
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
};

export function withAnswers(patch: Partial<Answers>): Answers {
  return { ...baseAnswers, ...patch };
}
