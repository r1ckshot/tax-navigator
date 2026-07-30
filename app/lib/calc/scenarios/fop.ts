import { getParams, sourcesOf } from '@/lib/rules/types';
import { round2, toRange } from '../range';
import type { Answers, ScenarioResult } from '../types';

/**
 * Укр ФОП, живучи в PL як резидент. KAS трактує віддалену роботу з території PL
 * як zakład → дохід оподатковується ТІЛЬКИ в PL за скалею, а укр єдиний податок
 * при цьому нараховується далі й НЕ зараховується — фактично подвійний тягар.
 *
 * «На руки» в злотих свідомо лишається без числа: дохід zakładu йде за скалею,
 * але складки ZUS саме для цього випадку в EVIDENCE не покриті, а припускати їх
 * заборонено (evidence-numbers.md).
 *
 * Український бік показуємо як дві окремі величини, не як суму: ЄП + ВЗ — частка
 * доходу, тож рахується у валюті виручки без курсу; мінімальний ЄСВ — фіксована
 * гривнева сума, і курс UAH→PLN ми не застосовуємо (DECISIONS 2026-07-29).
 */
export function calcFop(answers: Answers): ScenarioResult {
  const { ukrainianSingleTaxRate } = getParams<{ ukrainianSingleTaxRate: number }>(
    'fop.zaklad_in_pl',
  );
  const { vzRateGroup3, esvMinMonthlyUah } = getParams<{
    vzRateGroup3: number;
    esvMinMonthlyUah: number;
  }>('fop.esv_vz');

  const proportionalRate = round2(ukrainianSingleTaxRate + vzRateGroup3);

  return {
    id: 'fop',
    rangeMonthly: null,
    noRangeReasonKey: 'fop.noPlTakeHome',
    foreignBurden: {
      proportionalRate,
      proportionalMonthly: toRange(answers.monthlyRevenue * proportionalRate),
      fixedMonthlyUah: esvMinMonthlyUah,
    },
    risk: 'red',
    riskReasonKey: 'risk.fop.zaklad',
    noteKeys: [
      'fop.uaBurden',
      'fop.plSideNotVerified',
      'fop.doubleBurden',
      'fop.ryczaltRefused',
      ...(answers.hasActiveUaFop ? ['fop.appliesToYou'] : ['fop.hypothetical']),
    ],
    sources: sourcesOf('fop.zaklad_in_pl', 'fop.esv_vz', 'residency.treaty_tiebreakers'),
  };
}
