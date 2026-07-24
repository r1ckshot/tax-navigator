import ruleSet from './rules.2026.json';

/**
 * Правило = {profile, tax_year, rule_id, formula/params, source_url, verified_at}
 * (схема з docs/EVIDENCE.md §6). Кожна цифра носить своє джерело, щоб вимога
 * product-safety «цитата джерела на кожен висновок» виконувалась автоматично.
 */
export interface Rule<P = Record<string, unknown>> {
  rule_id: string;
  params: P;
  source_url: string;
  verified_at: string;
}

export interface RuleSet {
  tax_year: number;
  profile: string;
  verified_at: string;
  rules: Rule[];
}

export const RULES: RuleSet = ruleSet as RuleSet;

const byId = new Map(RULES.rules.map((r) => [r.rule_id, r]));

export function getRule<P>(ruleId: string): Rule<P> {
  const rule = byId.get(ruleId);
  if (!rule) throw new Error(`Unknown rule_id: ${ruleId}`);
  return rule as Rule<P>;
}

export function getParams<P>(ruleId: string): P {
  return getRule<P>(ruleId).params;
}

/** Джерело для цитати під висновком. */
export interface Source {
  ruleId: string;
  url: string;
  verifiedAt: string;
}

export function sourceOf(ruleId: string): Source {
  const rule = getRule(ruleId);
  return { ruleId, url: rule.source_url, verifiedAt: rule.verified_at };
}

export function sourcesOf(...ruleIds: string[]): Source[] {
  return ruleIds.map(sourceOf);
}
