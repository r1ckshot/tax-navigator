import { getParams, sourcesOf } from '@/lib/rules/types';
import { toRange, round2 } from '../range';
import type { Answers, ScenarioResult } from '../types';
import { skalaAnnualTax } from './shared';

interface EmployerParams {
  emerytalne: number;
  rentowe: number;
  wypadkowe: number;
  fpFs: number;
  fgsp: number;
}
interface EmployeeParams {
  emerytalne: number;
  rentowe: number;
  chorobowe: number;
  zdrowotnaRate: number;
}
interface UopPitParams {
  kupMonthly: number;
  kwotaZmniejszajacaMonthly: number;
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

/**
 * База порівняння. `employerCost` — та сама сума, яку витрачає клієнт/роботодавець
 * (apples-to-apples з B2B). `gross` існує тільки для звірки арифметики з
 * калібрувальним прикладом EVIDENCE, який рахований від брутто.
 */
export type UopBase = 'employerCost' | 'gross';

export function calcUop(answers: Answers, base: UopBase = 'employerCost'): ScenarioResult {
  const er = getParams<EmployerParams>('uop.employer_contributions');
  const ee = getParams<EmployeeParams>('uop.employee_contributions');
  const pit = getParams<UopPitParams>('uop.pit');
  const skala = getParams<SkalaParams>('jdg.skala');
  const cap = getParams<CapParams>('uop.annual_contribution_cap');

  const employerRate = er.emerytalne + er.rentowe + er.wypadkowe + er.fpFs + er.fgsp;
  const grossMonthly = base === 'gross' ? answers.monthlyRevenue : answers.monthlyRevenue / (1 + employerRate);

  // 30-krotność обмежує лише базу emerytalne+rentowe.
  const annualGross = grossMonthly * 12;
  const cappedAnnualBase = Math.min(annualGross, cap.annualBaseCap);
  const annualPension = cappedAnnualBase * (ee.emerytalne + ee.rentowe);
  const annualSickness = annualGross * ee.chorobowe;
  const annualSocial = annualPension + annualSickness;

  // zdrowotna 9% від (брутто − społeczne), від податку НЕ віднімається.
  const annualZdrowotna = (annualGross - annualSocial) * ee.zdrowotnaRate;

  const annualIncome = annualGross - annualSocial - pit.kupMonthly * 12;
  const annualTax = skalaAnnualTax(annualIncome, skala);

  const takeHomeMonthly = (annualGross - annualSocial - annualZdrowotna - annualTax) / 12;

  return {
    id: 'uop',
    rangeMonthly: toRange(round2(takeHomeMonthly)),
    risk: 'green',
    riskReasonKey: 'risk.uop.standard',
    noteKeys: base === 'employerCost' ? ['uop.employerCostBasis'] : [],
    sources: sourcesOf(
      'uop.employer_contributions',
      'uop.employee_contributions',
      'uop.pit',
      'uop.annual_contribution_cap'
    ),
  };
}
