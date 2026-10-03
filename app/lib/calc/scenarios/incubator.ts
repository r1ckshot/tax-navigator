import { getParams, sourcesOf } from '@/lib/rules/types';
import { toRange, round2, UNCERTAINTY } from '../range';
import { assessStatus } from '../status';
import { workNotes } from './status-gate';
import type { Answers, ScenarioResult, SubformResult } from '../types';
import { expenseRate, skalaAnnualTax, spanOf } from './shared';

interface IncubatorParams {
  kupStandard: number;
  kupCopyright: number;
  copyrightAnnualCap: number;
  subscriptionMonthlyMin: number;
  subscriptionMonthlyMax: number;
}
interface SkalaParams {
  lowerRate: number;
  upperRate: number;
  bracketThreshold: number;
  kwotaZmniejszajacaAnnual: number;
}

/**
 * Інкубатор: виплата за umową o dzieło — без ZUS і zdrowotnej, PIT за скалею від
 * приходу мінус нормативні KUP 20% або 50% (ліміт 120 000 на самі KUP). Податок
 * рахується тією ж `skalaAnnualTax`, що й у zlecenie, зі звірених ставок; до
 * 2026-10-01 тут стояли «ефективні ставки» 13,6% і 6%, і перша з них була ставкою
 * шкали до 2022 року (17% × 0,8) — EVIDENCE, сценарій E.
 *
 * Смуга лишається ширшою (оцінка): абонемент і структура договору залежать від
 * інкубатора. ZUS немає взагалі — це не «вигода», а відсутність пенсії й
 * лікарняних, і так і підписуємо.
 *
 * Фактичні витрати віднімаються від кишені, але не від податку: база тут
 * нормативна KUP 20/50%, а «на руки» — гроші після всіх реальних відпливів
 * (DECISIONS 2026-08-05, для інкубатора закрито 2026-09-17).
 */
export function calcIncubator(answers: Answers): ScenarioResult {
  const p = getParams<IncubatorParams>('incubator.kup');
  const skala = getParams<SkalaParams>('jdg.skala');
  const sources = sourcesOf('incubator.kup', 'jdg.skala');
  const subscription = (p.subscriptionMonthlyMin + p.subscriptionMonthlyMax) / 2;
  const expenses = answers.monthlyRevenue * expenseRate(answers.expenseShare);
  const annualGross = answers.monthlyRevenue * 12;

  /** На руки за місяць: прихід − PIT за скалею (від приходу мінус KUP) − абонемент − витрати. */
  const takeHomeMonthly = (annualKup: number) =>
    round2(answers.monthlyRevenue - skalaAnnualTax(annualGross - annualKup, skala) / 12 - subscription - expenses);

  const kup20: SubformResult = {
    id: 'kup20',
    rangeMonthly: toRange(takeHomeMonthly(annualGross * p.kupStandard), UNCERTAINTY.ESTIMATE),
    available: true,
    sources,
  };

  // 50% KUP вимагає утвору + клаузули передачі прав; ліміт 120k/рік на самі KUP.
  const copyrightAvailable = answers.workKind !== 'nonIt';
  const annualKup = annualGross * p.kupCopyright;
  const kup50: SubformResult = copyrightAvailable
    ? {
        id: 'kup50',
        rangeMonthly: toRange(takeHomeMonthly(Math.min(annualKup, p.copyrightAnnualCap)), UNCERTAINTY.ESTIMATE),
        available: true,
        sources,
      }
    : { id: 'kup50', rangeMonthly: null, available: false, unavailableReasonKey: 'incubator.noCopyrightWork', sources };

  // Діяльність веде юрособа інкубатора, людина підписує з нею dzieło чи zlecenie,
  // тобто потрібне право на працю, а не на JDG (EVIDENCE «Право працювати…», п. 6).
  const work = workNotes('incubator', assessStatus(answers.stayBasis));
  const noteKeys = [...work.noteKeys, 'incubator.isEstimate', 'incubator.noZus'];
  if (copyrightAvailable && annualKup > p.copyrightAnnualCap) noteKeys.push('incubator.copyrightCapExceeded');

  const subforms = [kup20, kup50];

  return {
    id: 'incubator',
    rangeMonthly: spanOf(subforms),
    risk: 'yellow',
    riskReasonKey: 'risk.incubator.dependency',
    noteKeys,
    subforms,
    sources: [...sources, ...work.sources],
  };
}
