import { sourcesOf } from '@/lib/rules/types';
import type { Answers, ScenarioResult } from '../types';

/**
 * Укр ФОП, живучи в PL як резидент. KAS трактує віддалену роботу з території PL
 * як zakład → дохід оподатковується ТІЛЬКИ в PL за скалею, а укр єдиний податок
 * при цьому нараховується далі й НЕ зараховується — фактично подвійний тягар.
 *
 * Числового діапазону свідомо НЕ показуємо: ЄСВ і ВЗ на 2026 не звірені
 * (українські офіційні домени поза firewall-allowlist — див. EVIDENCE, сценарій A).
 * Краще без числа, ніж із вигаданим.
 */
export function calcFop(answers: Answers): ScenarioResult {
  return {
    id: 'fop',
    rangeMonthly: null,
    risk: 'red',
    riskReasonKey: 'risk.fop.zaklad',
    noteKeys: [
      'fop.noNumericRange',
      'fop.doubleBurden',
      'fop.ryczaltRefused',
      ...(answers.hasActiveUaFop ? ['fop.appliesToYou'] : ['fop.hypothetical']),
    ],
    sources: sourcesOf('fop.zaklad_in_pl', 'residency.treaty_tiebreakers'),
  };
}
