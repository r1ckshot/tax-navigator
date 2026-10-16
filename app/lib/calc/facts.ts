import { sourceOf, getRule, type Source } from '@/lib/rules/types';

/**
 * Число з правила для тексту сторінки-відповіді: `ruleNumber('jdg.ryczalt.rate',
 * 'rateProgramming')` → 0.12 разом із джерелом. Ворота, а не зручність: текст
 * сторінки не має власних цифр (guard у `answer-page.test.ts`), тож кожна
 * показана цифра проходить тут і несе своє `source_url` + `verified_at`.
 *
 * Шлях — ключі `params` через крапку, індекс масиву числом (`tiers.0.monthly`).
 * Не число або немає такого шляху — виняток: сторінка не збереться з дірою
 * чи з `undefined` замість ставки.
 */
export interface RuleNumber {
  value: number;
  source: Source;
}

/** Дата з правила (ISO, `2028-03-04`) — для «захист продовжено до …» у тексті. */
export interface RuleDate {
  value: string;
  source: Source;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function leaf(ruleId: string, path: string): unknown {
  let node: unknown = getRule(ruleId).params;
  for (const key of path.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, key)) {
      throw new Error(`No value at ${ruleId}/${path}`);
    }
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

export function ruleNumber(ruleId: string, path: string): RuleNumber {
  const node = leaf(ruleId, path);
  if (typeof node !== 'number' || !Number.isFinite(node)) {
    throw new Error(`Not a number at ${ruleId}/${path}`);
  }
  return { value: node, source: sourceOf(ruleId) };
}

export function ruleDate(ruleId: string, path: string): RuleDate {
  const node = leaf(ruleId, path);
  if (typeof node !== 'string' || !ISO_DATE.test(node)) {
    throw new Error(`Not a date at ${ruleId}/${path}`);
  }
  return { value: node, source: sourceOf(ruleId) };
}
