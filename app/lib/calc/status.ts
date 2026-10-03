import { getParams, sourcesOf } from '@/lib/rules/types';
import type { Source } from '@/lib/rules/types';
import type { ScenarioId, StayBasis } from './types';

/**
 * Модель статусу: підстава перебування → які форми роботи закон дозволяє.
 * Країна — параметр уже зараз, хоча дані лише польські: наступна країна додає
 * свої правила, а не переписує інтерфейс (DECISIONS 2026-10-01, ROADMAP фаза 6).
 *
 * Два закони, дві осі (EVIDENCE «Право працювати…», п. 2 і 5):
 *   - бізнес (JDG, nierejestrowana) — art. 4 ustawy o przedsiębiorcach
 *     zagranicznych, правило `status.business_right`;
 *   - праця (UoP, zlecenie, інкубатор) — ustawa z 20.03.2025 o powierzaniu pracy,
 *     правило `status.work_right`. Інкубатор тут, а не в бізнесі: діяльність веде
 *     юрособа інкубатора, людина з нею лише підписує договір (п. 6).
 * Осі не збігаються: Niebieska Karta дає бізнес нарівні з поляками, а працю — лише
 * в межах дозволу; карта на роботу дає працю в межах дозволу і не дає бізнесу.
 */
export type Country = 'PL';

/**
 * allowed — закон дозволяє без умов; permitBound — лише на умовах дозволу на працю;
 * notAllowed — підстава поза переліком закону; unknown — анкета підстави не знає
 * («інша підстава» або старе посилання без неї), тож і висновку немає.
 */
export type Access = 'allowed' | 'permitBound' | 'notAllowed' | 'unknown';

export interface FormAccess {
  access: Access;
  /** Правило, з якого випливає висновок, — його джерело стоїть під формою. */
  ruleId: string;
}

export interface StatusResult {
  country: Country;
  basis: StayBasis | undefined;
  forms: Record<ScenarioId, FormAccess>;
  /** Лише для тимчасового захисту: до коли діє і що його гасить. CUKR — уже не захист. */
  protection?: { until: string; lostWhenAbroadDaysOver: number };
  sources: Source[];
}

/**
 * Відповідь анкети → код підстави в правилах. «Постійне перебування» в анкеті
 * один варіант на три коди закону (pobyt stały, rezydent UE, Karta Polaka): у
 * всіх трьох однаковий доступ і до бізнесу, і до праці — це тримає тест.
 */
export const BASIS_TO_RULE_CODE: Record<Exclude<StayBasis, 'other'>, string> = {
  eu_citizen: 'eu_eea_citizen',
  ukr: 'temporary_protection',
  cukr: 'cukr',
  permanent: 'permanent_residence',
  study: 'temp_residence_study',
  blue_card: 'blue_card',
  work_permit: 'temp_residence_work',
};

interface BusinessRightParams {
  equalToPolesBases: string[];
}
interface WorkRightParams {
  freeAccessBases: string[];
  permitBoundBases: string[];
}
interface ProtectionParams {
  protectionUntil: string;
  lostWhenAbroadDaysOver: number;
}

const BUSINESS = 'status.business_right';
const WORK = 'status.work_right';
const PROTECTION = 'status.ukr_protection';

function ruleCode(basis: StayBasis | undefined): string | undefined {
  if (basis === undefined || basis === 'other') return undefined;
  // Посилання для поширення несе сирий рядок: невідомий код — це «не знаємо», а не виняток.
  return Object.prototype.hasOwnProperty.call(BASIS_TO_RULE_CODE, basis)
    ? BASIS_TO_RULE_CODE[basis as keyof typeof BASIS_TO_RULE_CODE]
    : undefined;
}

export function assessStatus(basis: StayBasis | undefined, country: Country = 'PL'): StatusResult {
  const business = getParams<BusinessRightParams>(BUSINESS);
  const work = getParams<WorkRightParams>(WORK);
  const code = ruleCode(basis);

  const businessAccess: Access =
    code === undefined ? 'unknown' : business.equalToPolesBases.includes(code) ? 'allowed' : 'notAllowed';

  // Правило праці класифікує кожну підставу з переліку бізнесу (тест у rules.test),
  // а карту на роботу — у permitBound. Підстава поза обома списками невідома.
  const workAccess: Access =
    code === undefined
      ? 'unknown'
      : work.freeAccessBases.includes(code)
        ? 'allowed'
        : work.permitBoundBases.includes(code)
          ? 'permitBound'
          : 'unknown';

  const b: FormAccess = { access: businessAccess, ruleId: BUSINESS };
  const w: FormAccess = { access: workAccess, ruleId: WORK };

  const protectionParams = getParams<ProtectionParams>(PROTECTION);
  const protection =
    basis === 'ukr'
      ? { until: protectionParams.protectionUntil, lostWhenAbroadDaysOver: protectionParams.lostWhenAbroadDaysOver }
      : undefined;

  return {
    country,
    basis,
    forms: {
      // Український ФОП стоїть на праві України, польський закон про чужинців його не стосується.
      fop: { access: 'allowed', ruleId: 'fop.zaklad_in_pl' },
      jdg: b,
      nierejestrowana: b,
      incubator: w,
      zlecenie: w,
      uop: w,
    },
    protection,
    sources: protection ? sourcesOf(BUSINESS, WORK, PROTECTION) : sourcesOf(BUSINESS, WORK),
  };
}
