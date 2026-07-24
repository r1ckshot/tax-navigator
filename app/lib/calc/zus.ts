import { getParams, sourcesOf, type Source } from '@/lib/rules/types';
import type { Answers } from './types';

export type ZusStage = 'zbiegOnlyHealth' | 'ulgaNaStart' | 'preferencyjny' | 'duzy';

export interface ZusResult {
  stage: ZusStage;
  /** Складки społeczne на місяць. 0 — коли їх немає взагалі. */
  socialMonthly: number;
  reasonKeys: string[];
  sources: Source[];
}

interface StagesParams {
  preferencyjnyWithSickness: number;
  preferencyjnyWithoutSickness: number;
  duzyMonthly: number;
}

/**
 * Етап ZUS — порядок рішень має значення, кожен наступний крок дивиться лише те,
 * чого не вирішив попередній:
 *   1. Паралельний етат (zbieg tytułów) — społeczne з JDG не платяться взагалі.
 *   2. Były pracodawca — будь-який збіг (тотожний АБО частковий) знімає пільгу.
 *   3. Історія JDG за 60 міс — знімає право на ulga na start / preferencyjny.
 *   4. Інакше — етап за віком діяльності.
 */
export function assessZus(answers: Answers): ZusResult {
  const p = getParams<StagesParams>('jdg.zus.stages');
  const sources = sourcesOf('jdg.zus.stages');

  if (answers.hasParallelUop) {
    return {
      stage: 'zbiegOnlyHealth',
      socialMonthly: 0,
      reasonKeys: ['zus.zbieg'],
      sources,
    };
  }

  const reliefBlockedBy: string[] = [];
  if (answers.formerEmployer !== 'no') reliefBlockedBy.push('zus.blockedByFormerEmployer');
  if (answers.hadJdgInLast60Months === true) reliefBlockedBy.push('zus.blockedByPriorBusiness');

  if (reliefBlockedBy.length > 0) {
    return {
      stage: 'duzy',
      socialMonthly: p.duzyMonthly,
      reasonKeys: reliefBlockedBy,
      sources: answers.formerEmployer !== 'no' ? sourcesOf('jdg.zus.stages', 'jdg.byly_pracodawca') : sources,
    };
  }

  switch (answers.jdgStatus) {
    case 'none':
    case 'lt6':
      return { stage: 'ulgaNaStart', socialMonthly: 0, reasonKeys: ['zus.ulgaNaStart'], sources };
    case 'from6to30':
      return {
        stage: 'preferencyjny',
        socialMonthly: answers.voluntarySickness ? p.preferencyjnyWithSickness : p.preferencyjnyWithoutSickness,
        reasonKeys: ['zus.preferencyjny'],
        sources,
      };
    case 'gt30':
      return { stage: 'duzy', socialMonthly: p.duzyMonthly, reasonKeys: ['zus.duzy'], sources };
  }
}
