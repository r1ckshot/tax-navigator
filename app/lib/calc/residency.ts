import { getParams, sourcesOf } from '@/lib/rules/types';
import type { Answers, ResidencyBasis, ResidencyResult, TiebreakStep } from './types';

interface DaysParams {
  days: number;
}

/**
 * Резидентство PL: art. 3 ustawy o PIT + Objaśnienia MF 29.04.2021.
 * Резидент, якщо АБО >183 днів у PL, АБО центр життєвих інтересів у PL —
 * причому достатньо ОДНОГО з двох центрів (особистого або економічного).
 */
export function assessResidency(answers: Answers): ResidencyResult {
  const { days } = getParams<DaysParams>('residency.days_threshold');

  const byDays = isOverDaysThreshold(answers, days);
  const personalInPl = answers.personalCenter === 'PL';
  const economicInPl = answers.economicCenter === 'PL';
  const byDeclaration = answers.specialLaw52zr === 'yes';

  const basis: ResidencyBasis[] = [];
  if (byDays) basis.push('days');
  if (personalInPl) basis.push('centerPersonal');
  if (economicInPl) basis.push('centerEconomic');
  if (byDeclaration) basis.push('declaration52zr');

  const plResident = basis.length > 0;

  const personalInUa = answers.personalCenter === 'UA';
  const economicInUa = answers.economicCenter === 'UA';
  const hasUaTies = personalInUa || economicInUa || answers.permanentHomeInUa === true;
  const dualRisk = plResident && hasUaTies;

  return {
    plResident,
    basis,
    dualRisk,
    tiebreak: dualRisk ? resolveTiebreak(answers) : undefined,
    // Спецнорма діє до 31.12.2026 — попереджаємо завжди, коли нею скористались.
    sunsetNote: byDeclaration,
    sources: sourcesOf(
      'residency.days_threshold',
      ...(byDeclaration ? ['residency.special_norm_52zr'] : []),
      ...(dualRisk ? ['residency.treaty_tiebreakers'] : [])
    ),
  };
}

function isOverDaysThreshold(answers: Partial<Answers>, threshold: number): boolean {
  if (answers.daysInPl === 'gte183') return true;
  if (answers.daysInPl === 'lt183') return false;
  return (answers.daysInPlApprox ?? 0) > threshold;
}

/**
 * Чи впливає «стале житло в UA» на вердикт — отже, чи варто про нього питати.
 * Виведено з логіки вище, а не вгадано: permanentHomeInUa вмикає тай-брейкер
 * Конвенції лише коли (а) особа провізорно резидент PL і (б) центри інтересів не
 * стоять обидва чітко в PL. Якщо резидентства PL немає — Конвенція не запускається
 * взагалі; якщо обидва центри в PL — резидентство однозначне й тай-брейкер зайвий.
 * Питати про житло поза цими межами означало б зайвий екран без впливу на результат.
 */
export function homeInUaMatters(a: Partial<Answers>): boolean {
  const { days } = getParams<DaysParams>('residency.days_threshold');
  const plResident =
    isOverDaysThreshold(a, days) || a.personalCenter === 'PL' || a.economicCenter === 'PL' || a.specialLaw52zr === 'yes';
  if (!plResident) return false;
  const bothCentersPl = a.personalCenter === 'PL' && a.economicCenter === 'PL';
  return !bothCentersPl;
}

/**
 * Тай-брейки Конвенції 1993 art. 4 ust. 2, по черзі:
 * стале житло → центр інтересів → звичайне перебування → громадянство.
 * Показуємо, НА ЯКОМУ кроці ланцюг зупинився — як пояснення, не вирок.
 */
function resolveTiebreak(answers: Answers): { resolvedAt: TiebreakStep; result: 'PL' | 'UA' | 'unresolved' } {
  // 1. Стале житло. Живе в PL; якщо в UA житла не лишилось — питання закрите.
  if (!answers.permanentHomeInUa) {
    return { resolvedAt: 'permanentHome', result: 'PL' };
  }

  // 2. Центр інтересів — обидві осі разом.
  const inPl = countPlace(answers, 'PL');
  const inUa = countPlace(answers, 'UA');
  if (inPl > inUa) return { resolvedAt: 'centerOfInterests', result: 'PL' };
  if (inUa > inPl) return { resolvedAt: 'centerOfInterests', result: 'UA' };

  // 3. Звичайне перебування.
  if (answers.daysInPl === 'gte183') return { resolvedAt: 'habitualAbode', result: 'PL' };
  if (answers.daysInPl === 'lt183') return { resolvedAt: 'habitualAbode', result: 'UA' };

  // 4. Громадянство — далі продукт не йде: це вже індивідуальна оцінка.
  return { resolvedAt: 'citizenship', result: 'unresolved' };
}

function countPlace(answers: Answers, place: 'PL' | 'UA'): number {
  return (answers.personalCenter === place ? 1 : 0) + (answers.economicCenter === place ? 1 : 0);
}
