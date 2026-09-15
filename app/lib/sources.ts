import { RULES, type Rule } from './rules/types';
import { isStale } from './calc/freshness';

/**
 * Каталог джерел для сторінки `/sources`: усі правила, згруповані за першим
 * сегментом `rule_id`, кожне зі станом свіжості на момент `now`.
 *
 * Значень ставок тут немає свідомо. Сторінка показує, звідки цифра і коли її
 * звірено, а сама цифра живе лише в розрахунку поруч зі своїм висновком.
 */

/** Порядок груп на сторінці: резидентство першим, як на екрані результату. */
export const GROUP_ORDER = [
  'residency',
  'common',
  'fop',
  'jdg',
  'incubator',
  'nierejestrowana',
  'zlecenie',
  'uop',
] as const;

export type GroupId = (typeof GROUP_ORDER)[number];

export interface SourceEntry {
  ruleId: string;
  url: string;
  host: string;
  verifiedAt: string;
  stale: boolean;
}

export interface SourceGroup {
  id: GroupId;
  entries: SourceEntry[];
}

export interface SourceCatalog {
  groups: SourceGroup[];
  ruleCount: number;
  staleCount: number;
}

export function buildSourceCatalog(now: Date, rules: readonly Rule[] = RULES.rules): SourceCatalog {
  const byGroup = new Map<string, SourceEntry[]>();

  for (const rule of rules) {
    const group = rule.rule_id.split('.')[0];
    if (!(GROUP_ORDER as readonly string[]).includes(group)) {
      // Нова група без місця в порядку мовчки зникла б зі сторінки.
      throw new Error(`Rule group without a place on /sources: ${rule.rule_id}`);
    }
    const entries = byGroup.get(group) ?? [];
    entries.push({
      ruleId: rule.rule_id,
      url: rule.source_url,
      host: new URL(rule.source_url).hostname,
      verifiedAt: rule.verified_at,
      stale: isStale(rule.verified_at, now),
    });
    byGroup.set(group, entries);
  }

  const groups = GROUP_ORDER.filter((id) => byGroup.has(id)).map((id) => ({ id, entries: byGroup.get(id)! }));

  return {
    groups,
    ruleCount: rules.length,
    staleCount: groups.reduce((n, g) => n + g.entries.filter((e) => e.stale).length, 0),
  };
}
