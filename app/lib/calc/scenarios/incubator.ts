import { getParams, sourcesOf } from '@/lib/rules/types';
import { toRange, round2, UNCERTAINTY } from '../range';
import type { Answers, ScenarioResult, SubformResult } from '../types';
import { spanOf } from './shared';

interface IncubatorParams {
  kupCopyright: number;
  copyrightAnnualCap: number;
  effectivePitStandardEstimate: number;
  effectivePitCopyrightEstimate: number;
  subscriptionMonthlyMin: number;
  subscriptionMonthlyMax: number;
}

/**
 * Інкубатор. EVIDENCE §6 прямо називає еф. ставки ОЦІНКОЮ (залежать від структури
 * договору), тому смуга ширша й картка маркується як оцінка. ZUS немає взагалі —
 * це не «вигода», а відсутність пенсії й лікарняних, і так і підписуємо.
 */
export function calcIncubator(answers: Answers): ScenarioResult {
  const p = getParams<IncubatorParams>('incubator.kup');
  const sources = sourcesOf('incubator.kup');
  const subscription = (p.subscriptionMonthlyMin + p.subscriptionMonthlyMax) / 2;

  const kup20: SubformResult = {
    id: 'kup20',
    rangeMonthly: toRange(
      round2(answers.monthlyRevenue * (1 - p.effectivePitStandardEstimate) - subscription),
      UNCERTAINTY.ESTIMATE
    ),
    available: true,
    sources,
  };

  // 50% KUP вимагає утвору + клаузули передачі прав; ліміт 120k/рік на самі KUP.
  const copyrightAvailable = answers.workKind !== 'nonIt';
  const annualKup = answers.monthlyRevenue * 12 * p.kupCopyright;
  const kup50: SubformResult = copyrightAvailable
    ? {
        id: 'kup50',
        rangeMonthly: toRange(
          round2(answers.monthlyRevenue * (1 - p.effectivePitCopyrightEstimate) - subscription),
          UNCERTAINTY.ESTIMATE
        ),
        available: true,
        sources,
      }
    : { id: 'kup50', rangeMonthly: null, available: false, unavailableReasonKey: 'incubator.noCopyrightWork', sources };

  const noteKeys = ['incubator.isEstimate', 'incubator.noZus'];
  if (copyrightAvailable && annualKup > p.copyrightAnnualCap) noteKeys.push('incubator.copyrightCapExceeded');

  const subforms = [kup20, kup50];

  return {
    id: 'incubator',
    rangeMonthly: spanOf(subforms),
    risk: 'yellow',
    riskReasonKey: 'risk.incubator.dependency',
    noteKeys,
    subforms,
    sources,
  };
}
