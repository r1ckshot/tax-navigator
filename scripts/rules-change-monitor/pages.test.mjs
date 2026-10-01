import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pageText, pick } from './extract.mjs';
import { checkField, aggregateFields } from './fields.mjs';
import { PAGES, URLS } from './pages.mjs';
import { STATES } from './states.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { rules } = JSON.parse(readFileSync(join(HERE, '../../app/lib/rules/rules.2026.json'), 'utf8'));
const ruleById = (id) => rules.find((r) => r.rule_id === id);

/** Сторінки, зняті 2026-10-01 (`__fixtures__/pages/`), за ключем `URLS`. */
const FIXTURE_BY_URL = Object.fromEntries(
  Object.entries(URLS).map(([key, url]) => [url, readFileSync(join(HERE, '__fixtures__', 'pages', `${key}.html`), 'utf8')]),
);
const textOf = (url) => pageText(FIXTURE_BY_URL[url]);

const allFields = Object.entries(PAGES).flatMap(([ruleId, page]) =>
  Object.entries(page.fields).map(([param, field]) => ({ ruleId, param, field, url: field.url ?? page.url })),
);

const check = ({ ruleId, param, field, url }, text) =>
  checkField({ rule: ruleById(ruleId), param, field, url, text, failure_reason: null });

describe('кожне поле реєстру на справжній сторінці 2026-10-01', () => {
  it.each(allFields.map((f) => [`${f.ruleId} → ${f.param}`, f]))('%s збігається з матрицею', (_, f) => {
    const result = check(f, textOf(f.url));
    expect([STATES.MATCH, STATES.COSMETIC], `${f.ruleId}.${f.param}: ${result.failure_reason}`).toContain(result.state);
  });
});

/**
 * Мутаційна перевірка: значення на сторінці підмінене — поле мусить дати
 * розбіжність. `unavailable` тут теж провал: він означав би, що маркер
 * тримається за саме число, і зміна ставки ховалась би під «не вдалось
 * перевірити». `match` — що поле читає не те місце, яке ми думаємо.
 */
describe('мутація: підмінене на сторінці значення ловиться як розбіжність', () => {
  const numeric = allFields.filter((f) => f.field.kind !== 'quote');

  it.each(numeric.map((f) => [`${f.ruleId} → ${f.param}`, f]))('%s', (_, f) => {
    const text = textOf(f.url);
    const raw = pick(text, f.field);
    // Остання цифра значення +1 (9 → 0 без переносу): число гарантовано інше,
    // а формат, за яким його шукають, не змінюється.
    const bumped = raw.replace(/(\d)(?!.*\d)/, (d) => String((Number(d) + 1) % 10));
    const result = check(f, text.split(raw).join(bumped));
    expect(result.state, `${raw} → ${bumped}`).toBe(STATES.DIVERGENCE);
  });

  const quotes = allFields.filter((f) => f.field.kind === 'quote');

  it.each(quotes.map((f) => [`${f.ruleId} → ${f.param}`, f]))('%s: опорна фраза зникла — не підтверджено', (_, f) => {
    // Усі входження: фраза може стояти на сторінці двічі (zus.pl повторює абзац).
    const result = check(f, textOf(f.url).replace(new RegExp(f.field.quote.source, 'g'), '…'));
    expect(result.state).toBe(STATES.UNAVAILABLE);
    expect(result.failure_reason).toMatch(/опорної фрази/);
  });
});

describe('відомі пастки сторінок', () => {
  const field = (ruleId, param) => {
    const page = PAGES[ruleId];
    return { ruleId, param, field: page.fields[param], url: page.fields[param].url ?? page.url };
  };

  it('ліміт ryczałtu — 8 517 200, а не сусідні 8 517 000 małego podatnika', () => {
    const f = field('jdg.ryczalt.rate', 'annualLimit');
    expect(textOf(f.url)).toContain('8 517 000 zł');
    expect(pick(textOf(f.url), f.field)).toBe('8 517 200 zł');
  });

  it('kwota zmniejszająca 300 — зі шкали (3 600 / 12), а не «300 zł miesięcznie» KUP для доїзду', () => {
    const f = field('uop.pit', 'kwotaZmniejszajacaMonthly');
    expect(textOf(URLS.kupEtat)).toContain('3 600 zł (300 zł miesięcznie)');
    expect(f.url).toBe(URLS.stawki);
    expect(pick(textOf(f.url), f.field)).toBe('3 600 zł');
  });

  /**
   * Перша версія витягу (2026-08-26) брала перше входження маркера «minimalne
   * wynagrodzenie» — у навігації, де числа немає, — і повертала «120» з класу
   * меню. Зріз тієї сторінки досі тримає навігацію з цими словами.
   */
  it('мінімалка береться з контенту, а не з навігації з тими самими словами', () => {
    const page = readFileSync(join(HERE, '__fixtures__', 'zus-skladki.html'), 'utf8');
    expect(page).toContain('minimalnego-wynagrodzenia');
    expect(pick(pageText(page), PAGES['common.minimum_wage'].fields.monthly)).toBe('4806 zł');
  });

  it('база preferencyjna береться з таблиці preferencyjnej, а не з таблиці dużego ZUS', () => {
    const f = field('jdg.zus.stages', 'preferencyjnyBase');
    expect(pick(textOf(f.url), f.field)).toBe('1441,80 zł');
  });

  it('ставки ветованої реформи zdrowotnej 2025 не трапляються як значення полів', () => {
    const picked = Object.keys(PAGES['jdg.zdrowotna.ryczalt'].fields).map((param) =>
      pick(textOf(URLS.zus), PAGES['jdg.zdrowotna.ryczalt'].fields[param]),
    );
    for (const vetoed of ['376,16', '626,93', '1128,48', '1 128,48']) {
      expect(picked.join(' ')).not.toContain(vetoed);
    }
  });
});

describe('aggregateFields', () => {
  const rule = { rule_id: 'x', source_url: null, verified_at: '2026-07-18' };
  const f = (param, state) => ({ param, state, matrix_value: 1, fetched_value: 1, diff_percent: null, failure_reason: state === STATES.UNAVAILABLE ? 'немає' : null });

  it('розбіжність не ховається за недоступним полем', () => {
    const agg = aggregateFields(rule, [f('a', STATES.UNAVAILABLE), f('b', STATES.DIVERGENCE), f('c', STATES.MATCH)]);
    expect(agg.state).toBe(STATES.DIVERGENCE);
    expect(agg.param).toBe('b');
    expect(agg.fields).toHaveLength(3);
  });

  it('одне неперевірене поле робить неперевіреним усе правило', () => {
    const agg = aggregateFields(rule, [f('a', STATES.MATCH), f('b', STATES.UNAVAILABLE), f('c', STATES.UNAVAILABLE)]);
    expect(agg.state).toBe(STATES.UNAVAILABLE);
    expect(agg.failure_reason).toBe('b: немає (і ще полів у цьому стані: 1)');
  });

  it('збіг і косметика разом — косметика: правило підтверджене, формат інший', () => {
    expect(aggregateFields(rule, [f('a', STATES.MATCH), f('b', STATES.COSMETIC)]).state).toBe(STATES.COSMETIC);
  });
});
