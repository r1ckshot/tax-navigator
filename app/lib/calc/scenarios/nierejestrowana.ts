import { getParams, sourcesOf } from '@/lib/rules/types';
import { toRange, round2 } from '../range';
import type { Answers, ScenarioResult } from '../types';
import { expenseRate, skalaAnnualTax } from './shared';

interface LimitParams {
  quarterlyLimit: number;
  shareOfMinimumWage: number;
  settledQuarterlyFrom: string;
  priorBusinessLookbackMonths: number;
  daysToRegisterAfterExceeding: number;
  countsAccruedNotReceived: boolean;
}
interface ZusParams {
  servicesAreZlecenieTitle: boolean;
  goodsSaleIsNoTitle: boolean;
  payerIsClient: boolean;
  socialWaivedWhenUopAtLeastMinimumWage: boolean;
  zdrowotnaAlwaysDue: boolean;
}
interface ContributionParams {
  employer: { emerytalne: number; rentowe: number; wypadkowe: number; fpFs: number; fgsp: number };
  employee: { emerytalne: number; rentowe: number; chorobowe: number; zdrowotnaRate: number };
}
interface SkalaParams {
  lowerRate: number;
  upperRate: number;
  bracketThreshold: number;
  kwotaZmniejszajacaAnnual: number;
}

/** Та сама база порівняння, що в UoP і zleceniu: виручка = повний кошт замовника. */
export type NierejestrowanaBase = 'employerCost' | 'gross';

const MONTHS_IN_QUARTER = 3;

/**
 * Działalność nierejestrowana. Формально людина НЕ підприємець (art. 5 Prawa
 * przedsiębiorców), і саме тому сценарій поводиться інакше за всі решта: він
 * частіше показує ПРИЧИНУ, чому не підходить, ніж число (EVIDENCE §Сценарій H).
 *
 * Три відмінності від найближчого сусіда — zlecenia:
 *   1. Ліміт приходу 10,813.50 zł/КВАРТАЛ (225% мінімалки). У перерахунку на
 *      місяць — 3,604.50 zł, тобто медіанний профіль анкети поза ним учетверо.
 *   2. Умова 60 місяців без działalności gospodarczej — читається з наявних
 *      відповідей `jdgStatus` / `hadJdgInLast60Months`, нового питання не треба.
 *   3. KUP — фактичні задокументовані витрати (art. 20 ust. 1ba, «inne źródła»),
 *      не ричалтові 20%/50%. Тому тут працює `expenseShare`, а не ставка KUP.
 *
 * ⚠️ Складки. «Nierejestrowana = без ZUS» вірне лише для продажу ТОВАРІВ. За
 * послуги (наш профіль) договір є umową o świadczenie usług, тобто zleceniem за
 * k.c.: płatnikiem стає замовник, і складки ті самі, що в G, разом зі zbiegiem.
 */
export function calcNierejestrowana(
  answers: Answers,
  base: NierejestrowanaBase = 'employerCost'
): ScenarioResult {
  const limit = getParams<LimitParams>('nierejestrowana.limit');
  const zus = getParams<ZusParams>('nierejestrowana.zus');
  const c = getParams<ContributionParams>('zlecenie.contributions');
  const skala = getParams<SkalaParams>('jdg.skala');

  const sources = sourcesOf(
    'nierejestrowana.limit',
    'nierejestrowana.zus',
    'nierejestrowana.pit',
    'nierejestrowana.cudzoziemcy'
  );

  // Zbieg з етатом знімає społeczne так само, як у zleceniu — тоді і замовник не
  // платить своєї частини, тож кошт замовника дорівнює приходу людини.
  const socialWaived = zus.socialWaivedWhenUopAtLeastMinimumWage && answers.hasParallelUop;
  const employerRate = socialWaived
    ? 0
    : c.employer.emerytalne + c.employer.rentowe + c.employer.wypadkowe + c.employer.fpFs + c.employer.fgsp;

  // Ліміт міряє przychód NALEŻNY самій людині, а не повний кошт замовника — тож
  // з ним порівнюється брутто, те саме, з якого далі рахуються складки й податок.
  const grossMonthly = base === 'gross' ? answers.monthlyRevenue : answers.monthlyRevenue / (1 + employerRate);
  const quarterlyGross = grossMonthly * MONTHS_IN_QUARTER;

  // Зупинена JDG рахується як невиконувана діяльність, тому дивимось на статус,
  // а не на сам факт запису в CEIDG колись.
  const runsBusinessNow = answers.jdgStatus !== 'none';
  const hadBusinessInLookback = runsBusinessNow || answers.hadJdgInLast60Months === true;
  const overLimit = quarterlyGross > limit.quarterlyLimit;

  const noteKeys: string[] = ['nierejestrowana.zusOnServices'];
  if (overLimit) noteKeys.push('nierejestrowana.limitIsQuarterly');
  if (hadBusinessInLookback) noteKeys.push('nierejestrowana.lookback60');
  // Чи закриває шлях активна укр ФОП — не звірено: art. 5 говорить про польську
  // działalność gospodarczą, а трактування ФОП як zakładu (сценарій A) цього
  // питання не вирішує. Кажемо про невизначеність, а не вигадуємо відповідь.
  if (answers.hasActiveUaFop) noteKeys.push('nierejestrowana.uaFopNotVerified');
  noteKeys.push('nierejestrowana.foreignersLimited');

  const unavailable = (noRangeReasonKey: string): ScenarioResult => ({
    id: 'nierejestrowana',
    rangeMonthly: null,
    noRangeReasonKey,
    risk: 'yellow',
    riskReasonKey: 'risk.nierejestrowana.limitWatch',
    noteKeys,
    sources,
  });

  if (hadBusinessInLookback) return unavailable('nierejestrowana.priorBusiness');
  if (overLimit) return unavailable('nierejestrowana.overLimit');

  const annualGross = grossMonthly * 12;
  const chorobowe = answers.voluntarySickness ? c.employee.chorobowe : 0;
  // 30-krotność свідомо не рахується: стеля ліміту (10,813.50 × 4 ≈ 43.3k/рік)
  // на порядок нижча за річну базу 282,600 zł, тож гілка не має як спрацювати.
  const annualSocial = socialWaived
    ? 0
    : annualGross * (c.employee.emerytalne + c.employee.rentowe + chorobowe);
  const annualZdrowotna = (annualGross - annualSocial) * c.employee.zdrowotnaRate;

  // Витрати тут — фактичні задокументовані, тому беруться з відповіді анкети про
  // їх частку, як у JDG на скалі, а не з фіксованої ставки KUP.
  const annualExpenses = annualGross * expenseRate(answers.expenseShare);
  const annualTax = skalaAnnualTax(annualGross - annualExpenses - annualSocial, skala);

  const takeHomeMonthly = round2(
    (annualGross - annualExpenses - annualSocial - annualZdrowotna - annualTax) / 12
  );

  const availableNotes = [...noteKeys];
  availableNotes.push(
    answers.voluntarySickness ? 'nierejestrowana.choroboweIncluded' : 'nierejestrowana.choroboweSkipped'
  );
  availableNotes.push('nierejestrowana.actualCostsOnly', 'nierejestrowana.noMonthlyAdvances');
  if (socialWaived) availableNotes.unshift('nierejestrowana.zbieg');
  if (base === 'employerCost') availableNotes.push('uop.employerCostBasis');

  return {
    id: 'nierejestrowana',
    rangeMonthly: toRange(takeHomeMonthly),
    risk: 'yellow',
    riskReasonKey: 'risk.nierejestrowana.limitWatch',
    noteKeys: availableNotes,
    sources,
  };
}
