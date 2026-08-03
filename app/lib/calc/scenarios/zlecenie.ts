import { getParams, sourcesOf } from '@/lib/rules/types';
import { toRange, round2 } from '../range';
import type { Answers, ScenarioResult, SubformResult } from '../types';
import { skalaAnnualTax, spanOf } from './shared';

interface ContributionParams {
  employer: { emerytalne: number; rentowe: number; wypadkowe: number; fpFs: number; fgsp: number };
  employee: { emerytalne: number; rentowe: number; chorobowe: number; zdrowotnaRate: number };
  choroboweVoluntary: boolean;
}
interface KupParams {
  kupStandard: number;
  kupCopyright: number;
  copyrightAnnualCap: number;
}
interface ZbiegParams {
  socialWaivedWhenUopAtLeastMinimumWage: boolean;
}
interface SkalaParams {
  lowerRate: number;
  upperRate: number;
  bracketThreshold: number;
  kwotaZmniejszajacaAnnual: number;
}
interface CapParams {
  annualBaseCap: number;
}

/** Та сама база порівняння, що в UoP: виручка = повний кошт замовника. */
export type ZlecenieBase = 'employerCost' | 'gross';

/**
 * Umowa zlecenie. Ставки складок ті самі, що при UoP, тож окремим сценарієм його
 * робить не арифметика внесків, а три відмінності (EVIDENCE §Сценарій G):
 *   1. chorobowe ДОБРОВІЛЬНЕ — керується тією ж відповіддю `voluntarySickness`;
 *   2. KUP не фіксовані 250 zł/міс, а 20% приходу ПІСЛЯ społecznych (або 50% при
 *      передачі авторських прав, ліміт 120k/рік);
 *   3. zbieg з етатом знімає społeczne взагалі — лишається сама zdrowotna.
 *
 * Ризик жовтий не через податки: з 08.07.2026 PIP може рішенням перекваліфікувати
 * договір у трудовий, і перевіряються факти, а не назва договору.
 */
export function calcZlecenie(answers: Answers, base: ZlecenieBase = 'employerCost'): ScenarioResult {
  const c = getParams<ContributionParams>('zlecenie.contributions');
  const kup = getParams<KupParams>('zlecenie.kup');
  const zbieg = getParams<ZbiegParams>('zlecenie.zbieg_z_etatem');
  const skala = getParams<SkalaParams>('jdg.skala');
  const cap = getParams<CapParams>('uop.annual_contribution_cap');

  const sources = sourcesOf('zlecenie.contributions', 'zlecenie.kup', 'zlecenie.zbieg_z_etatem');

  // Zbieg: społeczne зі zlecenia не обов'язкові, тож і роботодавець своєї частини
  // не платить — кошт замовника дорівнює приходу.
  const socialWaived = zbieg.socialWaivedWhenUopAtLeastMinimumWage && answers.hasParallelUop;
  const employerRate = socialWaived
    ? 0
    : c.employer.emerytalne + c.employer.rentowe + c.employer.wypadkowe + c.employer.fpFs + c.employer.fgsp;

  const grossMonthly = base === 'gross' ? answers.monthlyRevenue : answers.monthlyRevenue / (1 + employerRate);
  const annualGross = grossMonthly * 12;

  // 30-krotność обмежує лише базу emerytalne+rentowe (як в UoP); chorobowe рахується
  // від повного приходу.
  const cappedAnnualBase = Math.min(annualGross, cap.annualBaseCap);
  const chorobowe = answers.voluntarySickness ? c.employee.chorobowe : 0;
  const annualSocial = socialWaived
    ? 0
    : cappedAnnualBase * (c.employee.emerytalne + c.employee.rentowe) + annualGross * chorobowe;

  // zdrowotna 9% від (прихід − społeczne), від податку НЕ віднімається — і вона
  // обов'язкова навіть тоді, коли społeczne знято збігом титулів.
  const annualZdrowotna = (annualGross - annualSocial) * c.employee.zdrowotnaRate;

  /** База KUP — прихід, зменшений на утримані społeczne (art. 22 ust. 9 pkt 4). */
  const kupBase = annualGross - annualSocial;

  const takeHomeMonthly = (annualKup: number) =>
    round2((annualGross - annualSocial - annualZdrowotna - skalaAnnualTax(kupBase - annualKup, skala)) / 12);

  const kup20: SubformResult = {
    id: 'kup20',
    rangeMonthly: toRange(takeHomeMonthly(kupBase * kup.kupStandard)),
    available: true,
    sources,
  };

  // 50% KUP вимагає утвору з передачею прав — та сама умова, що в інкубаторі.
  const copyrightAvailable = answers.workKind !== 'nonIt';
  const uncappedCopyrightKup = kupBase * kup.kupCopyright;
  const copyrightKup = Math.min(uncappedCopyrightKup, kup.copyrightAnnualCap);
  const kup50: SubformResult = copyrightAvailable
    ? { id: 'kup50', rangeMonthly: toRange(takeHomeMonthly(copyrightKup)), available: true, sources }
    : {
        id: 'kup50',
        rangeMonthly: null,
        available: false,
        unavailableReasonKey: 'zlecenie.noCopyrightWork',
        sources,
      };

  const noteKeys = [
    answers.voluntarySickness ? 'zlecenie.choroboweIncluded' : 'zlecenie.choroboweSkipped',
    'zlecenie.studentUnder26',
  ];
  if (socialWaived) noteKeys.unshift('zlecenie.zbieg');
  if (copyrightAvailable && uncappedCopyrightKup > kup.copyrightAnnualCap) {
    noteKeys.push('zlecenie.copyrightCapExceeded');
  }
  if (base === 'employerCost') noteKeys.push('uop.employerCostBasis');

  const subforms = [kup20, kup50];

  return {
    id: 'zlecenie',
    rangeMonthly: spanOf(subforms),
    risk: 'yellow',
    riskReasonKey: 'risk.zlecenie.reclassification',
    noteKeys,
    subforms,
    sources: [...sources, ...sourcesOf('zlecenie.przekwalifikowanie')],
  };
}
