import { getParams, sourcesOf } from '@/lib/rules/types';
import { toRange, round2 } from '../range';
import { assessZus } from '../zus';
import type { Answers, ScenarioResult, SubformResult } from '../types';
import { expenseRate, skalaAnnualTax, spanOf } from './shared';

interface RyczaltParams {
  rateProgramming: number;
  rateNarrowSupport: number;
  annualLimit: number;
}
interface ZdrowotnaRyczaltParams {
  tiers: { annualRevenueUpTo: number | null; monthly: number }[];
  deductibleShareOfRevenue: number;
}
interface LiniowyParams {
  rate: number;
  zdrowotnaRate: number;
  zdrowotnaMinMonthly: number;
  zdrowotnaAnnualDeductionCap: number;
}
interface SkalaParams {
  lowerRate: number;
  upperRate: number;
  bracketThreshold: number;
  kwotaZmniejszajacaAnnual: number;
  zdrowotnaRate: number;
  zdrowotnaMinMonthly: number;
}

export function calcJdg(answers: Answers): ScenarioResult {
  const zus = assessZus(answers);
  const subforms: SubformResult[] = [
    calcRyczalt(answers, zus.socialMonthly),
    calcLiniowy(answers, zus.socialMonthly),
    calcSkala(answers, zus.socialMonthly),
  ];

  const noteKeys: string[] = ['jdg.ipBoxNotIncluded', `zus.stage.${zus.stage}`, ...zus.reasonKeys];
  if (answers.hasParallelUop) noteKeys.push('jdg.zbiegExplanation');

  return {
    id: 'jdg',
    rangeMonthly: spanOf(subforms),
    risk: answers.formerEmployer === 'no' ? 'green' : 'yellow',
    riskReasonKey: answers.formerEmployer === 'no' ? 'risk.jdg.standard' : `risk.jdg.formerEmployer.${answers.formerEmployer}`,
    noteKeys,
    subforms,
    sources: zus.sources,
  };
}

/** Ричалт: 12% від ПРИХОДУ, витрати не віднімаються; 50% zdrowotnej зменшує базу. */
function calcRyczalt(answers: Answers, socialMonthly: number): SubformResult {
  const p = getParams<RyczaltParams>('jdg.ryczalt.rate');
  const z = getParams<ZdrowotnaRyczaltParams>('jdg.zdrowotna.ryczalt');
  const sources = sourcesOf('jdg.ryczalt.rate', 'jdg.zdrowotna.ryczalt');
  const annualRevenue = answers.monthlyRevenue * 12;

  if (annualRevenue > p.annualLimit) {
    return { id: 'ryczalt', rangeMonthly: null, available: false, unavailableReasonKey: 'ryczalt.overLimit', sources };
  }
  // art. 8 ust. 2: право втрачається лише при ТОТОЖНИХ послугах колишньому
  // роботодавцю. Частковий збіг ричалту не чіпає — він б'є тільки по пільзі ZUS.
  if (answers.formerEmployer === 'identical') {
    return { id: 'ryczalt', rangeMonthly: null, available: false, unavailableReasonKey: 'ryczalt.formerEmployer', sources };
  }
  if (answers.workKind === 'nonIt') {
    return { id: 'ryczalt', rangeMonthly: null, available: false, unavailableReasonKey: 'ryczalt.notItWork', sources };
  }

  const rate = answers.workKind === 'programming' ? p.rateProgramming : p.rateNarrowSupport;
  const zdrowotna = zdrowotnaForRevenue(z, annualRevenue);
  const taxBase = answers.monthlyRevenue - zdrowotna * z.deductibleShareOfRevenue;
  const tax = rate * taxBase;
  const takeHome = answers.monthlyRevenue - tax - zdrowotna - socialMonthly;

  return { id: 'ryczalt', rangeMonthly: toRange(round2(takeHome)), available: true, sources };
}

function zdrowotnaForRevenue(z: ZdrowotnaRyczaltParams, annualRevenue: number): number {
  for (const tier of z.tiers) {
    if (tier.annualRevenueUpTo === null || annualRevenue <= tier.annualRevenueUpTo) return tier.monthly;
  }
  return z.tiers[z.tiers.length - 1].monthly;
}

/** Лінійний: 19% від ДОХОДУ; zdrowotna 4.9% доходу, віднімається до річного ліміту. */
function calcLiniowy(answers: Answers, socialMonthly: number): SubformResult {
  const p = getParams<LiniowyParams>('jdg.liniowy');
  const sources = sourcesOf('jdg.liniowy');

  const expenses = answers.monthlyRevenue * expenseRate(answers.expenseShare);
  const income = answers.monthlyRevenue - expenses - socialMonthly;
  const zdrowotna = Math.max(p.zdrowotnaRate * income, p.zdrowotnaMinMonthly);
  const deductibleZdrowotna = Math.min(zdrowotna, p.zdrowotnaAnnualDeductionCap / 12);
  const tax = Math.max(0, p.rate * (income - deductibleZdrowotna));
  const takeHome = answers.monthlyRevenue - expenses - socialMonthly - tax - zdrowotna;

  return { id: 'liniowy', rangeMonthly: toRange(round2(takeHome)), available: true, sources };
}

/** Скаля: 12%/32%, kwota zmniejszająca раз на рік; zdrowotna 9% доходу. */
function calcSkala(answers: Answers, socialMonthly: number): SubformResult {
  const p = getParams<SkalaParams>('jdg.skala');
  const sources = sourcesOf('jdg.skala');

  const expenses = answers.monthlyRevenue * expenseRate(answers.expenseShare);
  const income = answers.monthlyRevenue - expenses - socialMonthly;
  const zdrowotna = Math.max(p.zdrowotnaRate * income, p.zdrowotnaMinMonthly);
  const annualTax = skalaAnnualTax(income * 12, p);
  const takeHome = answers.monthlyRevenue - expenses - socialMonthly - annualTax / 12 - zdrowotna;

  return { id: 'skala', rangeMonthly: toRange(round2(takeHome)), available: true, sources };
}
