import type { Answers } from '../types';

/**
 * Базовий профіль: IT-B2B, резидент PL, повний ZUS, виручка 15,000 zł/міс.
 * Статус UKR і кілька замовників — підстава, що дозволяє всі шість форм, тож
 * еталони G2 і benchmark рахуються так само, як до моделі статусу (сесія 06).
 */
export const baseAnswers: Answers = {
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

export function withAnswers(patch: Partial<Answers>): Answers {
  return { ...baseAnswers, ...patch };
}
