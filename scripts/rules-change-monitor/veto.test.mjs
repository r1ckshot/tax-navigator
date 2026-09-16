import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyVeto, readVetoRegistry, validateRegistry } from './veto.mjs';
import { runCycle } from './cycle.mjs';
import { STATES } from './states.mjs';

const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), 'veto-registry.json');
const NOW = new Date('2026-09-16T08:00:00Z');

const entry = (overrides = {}) => ({
  rule_id: 'jdg.zdrowotna.ryczalt',
  vetoed_value: '376.16',
  reason: 'ветована реформа 2025',
  source: 'docs/EVIDENCE.md',
  created_at: '2026-09-16',
  ...overrides,
});

const check = (overrides = {}) => ({
  rule_id: 'jdg.zdrowotna.ryczalt',
  state: STATES.DIVERGENCE,
  matrix_value: 498.35,
  fetched_value: 376.16,
  diff_percent: -24.52,
  failure_reason: null,
  fetched_from: 'https://example.test/page',
  source_url: 'https://stat.gov.pl/',
  verified_at: '2026-07-18',
  ...overrides,
});

describe('applyVeto', () => {
  it('ветована цифра замість розбіжності — needs_confirmation з причиною і джерелом veto', () => {
    const result = applyVeto(check(), [entry()]);
    expect(result.state).toBe(STATES.NEEDS_CONFIRMATION);
    expect(result.failure_reason).toContain('376.16');
    expect(result.veto).toEqual({ vetoed_value: '376.16', reason: 'ветована реформа 2025', source: 'docs/EVIDENCE.md' });
  });

  it('матриця сама тримає ветовану цифру — match теж перекривається', () => {
    const result = applyVeto(check({ state: STATES.MATCH, matrix_value: 376.16, diff_percent: null }), [entry()]);
    expect(result.state).toBe(STATES.NEEDS_CONFIRMATION);
  });

  it('збіг рахується за числом, а не за рядком: 1 128,48 zł = 1128.48', () => {
    const result = applyVeto(check({ fetched_value: 1128.48 }), [entry({ vetoed_value: '1 128,48 zł' })]);
    expect(result.state).toBe(STATES.NEEDS_CONFIRMATION);
  });

  it('те саме число в іншого правила — не veto', () => {
    const result = applyVeto(check({ rule_id: 'common.minimum_wage' }), [entry()]);
    expect(result.state).toBe(STATES.DIVERGENCE);
  });

  it('інше число того самого правила — розбіжність лишається розбіжністю', () => {
    const result = applyVeto(check({ fetched_value: 520 }), [entry()]);
    expect(result.state).toBe(STATES.DIVERGENCE);
    expect(result.veto).toBeUndefined();
  });

  it('недоступне джерело не стає needs_confirmation: числа не було', () => {
    const input = check({ state: STATES.UNAVAILABLE, fetched_value: null });
    expect(applyVeto(input, [entry()])).toBe(input);
  });

  it('вхідний запис не мутується', () => {
    const input = check();
    applyVeto(input, [entry()]);
    expect(input.state).toBe(STATES.DIVERGENCE);
  });
});

describe('реєстр veto', () => {
  it('битий запис валить читання, а не тихо не спрацьовує', () => {
    expect(() => validateRegistry({ entries: [entry({ reason: '' })] })).toThrow(/reason/);
    expect(() => validateRegistry({ entries: [entry({ vetoed_value: 'скасовано' })] })).toThrow(/не число/);
    expect(() => validateRegistry({ veto: [] })).toThrow(/entries/);
  });

  it('відсутній файл — помилка, а не порожній список', () => {
    const dir = mkdtempSync(join(tmpdir(), 'veto-'));
    expect(() => readVetoRegistry(join(dir, 'nope.json'))).toThrow(/не знайдено/);
    writeFileSync(join(dir, 'bad.json'), '{', 'utf8');
    expect(() => readVetoRegistry(join(dir, 'bad.json'))).toThrow(/не валідний JSON/);
  });

  /**
   * Анти-регрес на калібрувальний приклад: реєстр у репо мусить тримати всі
   * три ветовані ставки (`docs/EVIDENCE.md`, «Нестабільності» п.1, і той самий
   * список у `app/lib/calc/__tests__/rules.test.ts`). Зникне хоч одна —
   * гілка AC-10 для неї мовчки вимкнеться.
   */
  it('справжній реєстр тримає три ветовані ставки zdrowotnej 2025', () => {
    const entries = readVetoRegistry(REGISTRY);
    const zdrowotna = entries.filter((e) => e.rule_id === 'jdg.zdrowotna.ryczalt').map((e) => Number(e.vetoed_value));
    expect(zdrowotna.sort((a, b) => a - b)).toEqual([376.16, 626.93, 1128.48]);
  });
});

describe('veto у циклі (AC-10 + AC-derived S-4)', () => {
  const rule = {
    rule_id: 'jdg.zdrowotna.ryczalt',
    params: { tiers: [{ annualRevenueUpTo: 60000, monthly: 498.35 }] },
    source_url: 'https://www.zus.pl/baza-wiedzy/x',
    verified_at: '2026-07-18',
  };
  const extractors = {
    'jdg.zdrowotna.ryczalt': {
      url: 'https://example.test/zdrowotna',
      matrixValue: (params) => params.tiers[0].monthly,
      extract: (html) => html,
    },
  };
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '376,16 zł' });

  /**
   * Veto не одноразове: кожен цикл перераховує стан із нуля, і сторінка, що
   * вперто повторює ветовану ставку, щомісяця знову стоїть перед людиною.
   */
  it('три цикли поспіль — needs_confirmation щоразу, ніколи match чи divergence', async () => {
    const vetoes = readVetoRegistry(REGISTRY);
    for (let month = 9; month <= 11; month += 1) {
      const cycle = await runCycle({
        rules: [rule],
        now: new Date(`2026-${String(month).padStart(2, '0')}-16T08:00:00Z`),
        fetchImpl,
        extractors,
        vetoes,
      });
      expect(cycle.checks[0].state).toBe(STATES.NEEDS_CONFIRMATION);
      expect(cycle.checks[0].fetched_value).toBe(376.16);
    }
  });

  it('без реєстру та сама сторінка дає розбіжність — гілку тримає саме veto', async () => {
    const cycle = await runCycle({ rules: [rule], now: NOW, fetchImpl, extractors });
    expect(cycle.checks[0].state).toBe(STATES.DIVERGENCE);
  });
});
