import { sourcesOf } from '@/lib/rules/types';
import type { Source } from '@/lib/rules/types';
import type { StatusResult } from '../status';
import type { ScenarioId, ScenarioResult } from '../types';

/**
 * Як висновок про право доходить до картки сценарію. JDG і nierejestrowana без
 * права на бізнес не ховаються: лишаються в порівнянні з причиною і джерелом
 * замість числа — людина бачить, що варіант існує, але не для її підстави (PRD
 * AC-1). `null` — право є, сценарій рахується як завжди.
 */
export function businessGate(
  id: Extract<ScenarioId, 'jdg' | 'nierejestrowana'>,
  status: StatusResult,
  extraSources: Source[] = []
): ScenarioResult | null {
  const { access, ruleId } = status.forms[id];
  if (access === 'allowed') return null;
  // permitBound для бізнесу в даних не буває: art. 4 або дає рівність із поляками, або ні.
  const blocked = access === 'notAllowed' || access === 'permitBound';
  return {
    id,
    rangeMonthly: null,
    noRangeReasonKey: blocked ? 'status.business.notAllowed' : 'status.business.unknown',
    // Вести JDG без підстави з переліку закону — не «дорожче», а поза законом.
    risk: blocked ? 'red' : 'yellow',
    riskReasonKey: blocked ? 'risk.status.business.notAllowed' : 'risk.status.business.unknown',
    noteKeys: [],
    sources: [...sourcesOf(ruleId), ...extraSources],
  };
}

/** Нотатки про строк захисту для форм, право на які тримається на UKR. */
export function protectionNotes(status: StatusResult): Pick<ScenarioResult, 'noteKeys' | 'noteVars' | 'sources'> {
  if (!status.protection) return { noteKeys: [], sources: [] };
  return {
    noteKeys: ['status.ukrProtection'],
    noteVars: {
      protectionUntil: status.protection.until,
      abroadDays: String(status.protection.lostWhenAbroadDaysOver),
    },
    sources: sourcesOf('status.ukr_protection'),
  };
}

/**
 * UoP, zlecenie, інкубатор: число лишається завжди — закон не забороняє цих форм
 * жодній підставі з анкети, а лише ставить умову дозволу. Тож замість причини —
 * примітка (PRD AC-2): для вільного доступу її немає.
 */
export function workNotes(
  id: Extract<ScenarioId, 'uop' | 'zlecenie' | 'incubator'>,
  status: StatusResult
): { noteKeys: string[]; sources: Source[] } {
  const { access, ruleId } = status.forms[id];
  if (access === 'allowed') return { noteKeys: [], sources: [] };
  const key = access === 'permitBound' ? 'status.work.permitBound' : 'status.work.unknown';
  return { noteKeys: [key], sources: sourcesOf(ruleId) };
}
