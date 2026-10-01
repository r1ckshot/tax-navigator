import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isScriptable } from './allowlist.mjs';
import { DERIVED, METHODS, VERIFICATION, leafPaths, valueAt } from './methods.mjs';
import { PAGES } from './pages.mjs';

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../app/lib/rules');

/**
 * Усі файли правил, а не лише `rules.2026.json`: нова країна чи новий рік
 * прийдуть сусіднім файлом, і guard має їх побачити без жодної правки тут.
 */
function allRules() {
  return readdirSync(RULES_DIR)
    .filter((name) => /^rules\..+\.json$/.test(name))
    .flatMap((name) => JSON.parse(readFileSync(join(RULES_DIR, name), 'utf8')).rules.map((rule) => ({ file: name, rule })));
}

const METHOD_VALUES = Object.values(METHODS);

/**
 * Guard DECISIONS 2026-10-01: правило без способу звірки — червоний `npm test`.
 * Мутацією перевірено 2026-10-01: прибраний запис `uop.pit` з VERIFICATION
 * валить перший тест із назвою правила в тексті помилки.
 */
describe('guard: кожне правило має спосіб звірки', () => {
  const rules = allRules();

  it('правила знайдено — guard не зелений від порожнечі', () => {
    expect(rules.length).toBeGreaterThanOrEqual(26);
  });

  it('у кожного правила є запис у VERIFICATION', () => {
    const missing = rules.filter(({ rule }) => !VERIFICATION[rule.rule_id]).map(({ file, rule }) => `${file}: ${rule.rule_id}`);
    expect(missing, 'додай спосіб звірки в scripts/rules-change-monitor/methods.mjs').toEqual([]);
  });

  it('спосіб — один із п\'яти, і з причиною', () => {
    for (const [ruleId, entry] of Object.entries(VERIFICATION)) {
      expect(METHOD_VALUES, ruleId).toContain(entry.method);
      expect(entry.why?.trim().length, `${ruleId}: why`).toBeGreaterThan(10);
    }
  });

  it('у реєстрі немає записів-сиріт без правила', () => {
    const ids = new Set(rules.map(({ rule }) => rule.rule_id));
    expect(Object.keys(VERIFICATION).filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe('guard: спосіб page покриває кожен лист правила', () => {
  const rules = allRules();
  const pageRules = rules.filter(({ rule }) => VERIFICATION[rule.rule_id]?.method === METHODS.PAGE);

  it('page-правило має сторінку, а сторінка — page-правило', () => {
    expect(pageRules.filter(({ rule }) => !PAGES[rule.rule_id]).map(({ rule }) => rule.rule_id)).toEqual([]);
    expect(Object.keys(PAGES).filter((id) => VERIFICATION[id]?.method !== METHODS.PAGE)).toEqual([]);
  });

  /**
   * Без цього «збігається» могло б означати «збіглась одна цифра з семи», а
   * бот-PR (сесія 04) оновив би `verified_at` усьому правилу.
   */
  it('кожен лист params — або поле сторінки, або elsewhere зі способом і причиною', () => {
    for (const { rule } of pageRules) {
      const page = PAGES[rule.rule_id];
      const covered = new Set([...Object.keys(page.fields), ...Object.keys(page.elsewhere ?? {})]);
      const leaves = leafPaths(rule.params);
      expect(leaves.filter((p) => !covered.has(p)), `${rule.rule_id}: листи без звірки`).toEqual([]);
      expect([...covered].filter((p) => !leaves.includes(p)), `${rule.rule_id}: поля без листа`).toEqual([]);
      for (const [param, entry] of Object.entries(page.elsewhere ?? {})) {
        expect([...METHOD_VALUES, DERIVED], `${rule.rule_id}.${param}`).toContain(entry.method);
        expect(entry.why?.trim().length, `${rule.rule_id}.${param}: why`).toBeGreaterThan(10);
      }
    }
  });

  it('поле не дублюється в elsewhere', () => {
    for (const [ruleId, page] of Object.entries(PAGES)) {
      const both = Object.keys(page.fields).filter((p) => p in (page.elsewhere ?? {}));
      expect(both, ruleId).toEqual([]);
    }
  });

  it('кожна сторінка — на хості, який цикл має право відкривати (AC-02)', () => {
    for (const [ruleId, page] of Object.entries(PAGES)) {
      for (const url of [page.url, ...Object.values(page.fields).map((f) => f.url).filter(Boolean)]) {
        expect(isScriptable(url), `${ruleId}: ${url}`).toBe(true);
      }
    }
  });

  it('цитата стоїть лише там, де матриця несе твердження, а не число', () => {
    for (const { rule } of pageRules) {
      for (const [param, field] of Object.entries(PAGES[rule.rule_id].fields)) {
        const value = valueAt(rule.params, param);
        if (field.kind === 'quote') expect(typeof value === 'number', `${rule.rule_id}.${param}`).toBe(false);
        if (field.kind === 'number') expect(typeof value, `${rule.rule_id}.${param}`).toBe('number');
      }
    }
  });
});

/**
 * Таблиця для людини згенерована з реєстру, але правиться руками, тож може
 * розійтись. Тест тримає дві речі: кожне правило в ній є, і спосіб той самий.
 */
describe('verification-methods.md збігається з реєстром', () => {
  const doc = readFileSync(join(RULES_DIR, '../../../docs/features/rules-change-monitor/verification-methods.md'), 'utf8');

  it('кожне правило має рядок із тим самим способом', () => {
    const wrong = allRules()
      .map(({ rule }) => rule.rule_id)
      .filter((id) => !doc.includes(`| \`${id}\` | \`${VERIFICATION[id]?.method}\` |`));
    expect(wrong).toEqual([]);
  });
});

describe('leafPaths', () => {
  it('масив об\'єктів розкривається, масив рядків — один лист', () => {
    expect(leafPaths({ a: 1, tiers: [{ x: 1 }, { x: null }], order: ['a', 'b'], n: { k: true } })).toEqual([
      'a',
      'tiers.0.x',
      'tiers.1.x',
      'order',
      'n.k',
    ]);
  });
});
