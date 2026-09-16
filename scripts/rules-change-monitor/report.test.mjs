import { describe, expect, it } from 'vitest';

import { STATES } from './states.mjs';
import { renderReport, summaryLine } from './report.mjs';

function makeCheck(overrides = {}) {
  return {
    rule_id: 'zdrowotna-2026',
    state: STATES.MATCH,
    matrix_value: 4806,
    fetched_value: 4806,
    diff_percent: null,
    failure_reason: null,
    source_url: 'https://zus.pl/przykladowe-zrodlo',
    verified_at: '2026-08-01',
    ...overrides,
  };
}

describe('renderReport — заблоковані входи', () => {
  const blocked = makeCheck({
    rule_id: 'common.minimum_wage',
    state: STATES.UNAVAILABLE,
    blocked: true,
    matrix_value: null,
    fetched_value: null,
    failure_reason: 'вхід заблоковано до моделі: згадка файлів із секретами (secret-file)',
    fetched_from: 'https://www.zus.pl/baza-wiedzy/x',
  });

  it('стоїть першою секцією — вона ставить під сумнів решту звіту', () => {
    const report = renderReport({ month: '2026-09', status: 'blocked', checks: [blocked] });
    expect(report.indexOf('## Заблоковані входи')).toBeGreaterThanOrEqual(0);
    expect(report.indexOf('## Розбіжності')).toBeGreaterThan(report.indexOf('## Заблоковані входи'));
  });

  it('шапка називає блокування, а не «цикл неповний»', () => {
    const report = renderReport({ month: '2026-09', status: 'blocked', checks: [blocked] });
    expect(report).toContain('звернення до агента');
    expect(report).not.toContain('Цикл неповний');
  });

  it('друкує причину й сторінку, але не значення — його не брали', () => {
    const report = renderReport({ month: '2026-09', status: 'blocked', checks: [blocked] });
    expect(report).toContain('secret-file');
    expect(report).toContain('вхід відхилено до витягу значення');
  });

  it('порожній розділ друкується явно — відсутність не читається як «не перевіряли»', () => {
    const report = renderReport({ month: '2026-09', status: 'completed', checks: [makeCheck()] });
    expect(report).toContain('## Заблоковані входи\n\nНемає.');
  });
});

describe('renderReport', () => {
  it('секція розбіжностей стоїть вище за рядок match/cosmetic', () => {
    const cycle = {
      month: '2026-08',
      checks: [
        makeCheck({ rule_id: 'a', state: STATES.MATCH }),
        makeCheck({ rule_id: 'b', state: STATES.DIVERGENCE, matrix_value: 4806, fetched_value: 5000, diff_percent: 4.03 }),
      ],
    };

    const report = renderReport(cycle);
    const divergenceIndex = report.indexOf('## Розбіжності');
    const confirmedIndex = report.indexOf('## Підтверджено');

    expect(divergenceIndex).toBeGreaterThanOrEqual(0);
    expect(confirmedIndex).toBeGreaterThan(divergenceIndex);
  });

  it('секція розбіжностей стоїть вище за непідтверджені стани', () => {
    const cycle = {
      month: '2026-08',
      checks: [
        makeCheck({ rule_id: 'a', state: STATES.UNAVAILABLE, failure_reason: 'timeout' }),
        makeCheck({ rule_id: 'b', state: STATES.DIVERGENCE, diff_percent: 4.03 }),
      ],
    };

    const report = renderReport(cycle);
    const divergenceIndex = report.indexOf('## Розбіжності');
    const unconfirmedIndex = report.indexOf('## Непідтверджені стани');

    expect(divergenceIndex).toBeLessThan(unconfirmedIndex);
  });

  it('кожна розбіжність несе source_url і verified_at у тексті звіту', () => {
    const cycle = {
      month: '2026-08',
      checks: [
        makeCheck({
          rule_id: 'zdrowotna-2026',
          state: STATES.DIVERGENCE,
          matrix_value: 4806,
          fetched_value: 5000,
          diff_percent: 4.03,
          source_url: 'https://zus.pl/przykladowe-zrodlo',
          verified_at: '2026-08-01',
        }),
      ],
    };

    const report = renderReport(cycle);

    expect(report).toContain('https://zus.pl/przykladowe-zrodlo');
    expect(report).toContain('2026-08-01');
  });

  it('кожен непідтверджений стан має власну підсекцію з причиною', () => {
    const cycle = {
      month: '2026-08',
      checks: [
        makeCheck({ rule_id: 'a', state: STATES.UNAVAILABLE, failure_reason: 'timeout після 8с' }),
        makeCheck({ rule_id: 'b', state: STATES.OUT_OF_SCOPE, failure_reason: 'джерело за WAF' }),
        makeCheck({ rule_id: 'c', state: STATES.NOT_VERIFIED, failure_reason: 'немає verified_at' }),
        makeCheck({ rule_id: 'd', state: STATES.NEEDS_CONFIRMATION, failure_reason: 'раніше ветовано' }),
      ],
    };

    const report = renderReport(cycle);

    expect(report).toContain('Джерело недоступне');
    expect(report).toContain('timeout після 8с');
    expect(report).toContain('Поза скоупом автозвірки');
    expect(report).toContain('джерело за WAF');
    expect(report).toContain('Немає ручної верифікації');
    expect(report).toContain('немає verified_at');
    expect(report).toContain('Потребує підтвердження людини');
    expect(report).toContain('раніше ветовано');
  });

  it('ветована цифра несе обидва значення, джерело veto і посилання матриці', () => {
    const report = renderReport({
      month: '2026-09',
      checks: [
        makeCheck({
          rule_id: 'jdg.zdrowotna.ryczalt',
          state: STATES.NEEDS_CONFIRMATION,
          matrix_value: 498.35,
          fetched_value: 376.16,
          failure_reason: 'джерело повертає ветовану цифру 376.16: реформа 2025',
          fetched_from: 'https://example.test/zdrowotna',
          veto: { vetoed_value: '376.16', reason: 'реформа 2025', source: 'docs/EVIDENCE.md' },
        }),
      ],
    });

    for (const part of ['матриця: 498.35', 'джерело: 376.16', 'veto задокументовано: docs/EVIDENCE.md',
      'взято зі сторінки: https://example.test/zdrowotna', 'https://zus.pl/przykladowe-zrodlo', '2026-08-01']) {
      expect(report).toContain(part);
    }
  });

  it('match і cosmetic згорнуті в один рядок-лічильник, не перелічені кожен', () => {
    const cycle = {
      month: '2026-08',
      checks: [
        makeCheck({ rule_id: 'a', state: STATES.MATCH }),
        makeCheck({ rule_id: 'b', state: STATES.COSMETIC }),
      ],
    };

    const report = renderReport(cycle);

    expect(report).toContain('2 правил збігаються з джерелом');
    expect(report).not.toContain('### a');
    expect(report).not.toContain('### b');
  });

  it('звіт із порожнім циклом не падає', () => {
    expect(() => renderReport({ month: '2026-08', checks: [] })).not.toThrow();
    expect(() => renderReport({ month: '2026-08' })).not.toThrow();
  });

  it('звіт не містить порад до дії — лише факти й констатацію потреби рішення', () => {
    const cycle = {
      month: '2026-08',
      checks: [makeCheck({ rule_id: 'a', state: STATES.DIVERGENCE, diff_percent: 4.03 })],
    };

    const report = renderReport(cycle);

    expect(report.toLowerCase()).not.toMatch(/онов[иі]|постав\s|зміни ставку/);
  });
});

describe('summaryLine', () => {
  it('рахує перевірено/розбіжності/непідтверджені окремо', () => {
    const cycle = {
      month: '2026-08',
      checks: [
        makeCheck({ rule_id: 'a', state: STATES.MATCH }),
        makeCheck({ rule_id: 'b', state: STATES.DIVERGENCE }),
        makeCheck({ rule_id: 'c', state: STATES.UNAVAILABLE }),
        makeCheck({ rule_id: 'd', state: STATES.NOT_VERIFIED }),
      ],
    };

    const line = summaryLine(cycle);

    expect(line).toContain('2026-08');
    expect(line).toContain('перевірено 4');
    expect(line).toContain('розбіжностей 1');
    expect(line).toContain('непідтверджених 2');
  });

  it('не падає на порожньому циклі', () => {
    expect(() => summaryLine({ month: '2026-08' })).not.toThrow();
  });

  /**
   * Знахідка рев'ю з чистим контекстом: `status: partial` жив лише в
   * cycle-history.json, а людина читає звіт. Цикл, де впали всі джерела,
   * показував «Розбіжності: немає» без жодної згадки, що звірки не було.
   */
  it('неповний цикл каже про це в шапці, а не лише в історії', () => {
    const partial = { month: '2026-08', status: 'partial', checks: [] };
    expect(renderReport(partial)).toMatch(/Цикл неповний/);
  });

  it('повний цикл банера не має', () => {
    const done = { month: '2026-08', status: 'completed', checks: [] };
    expect(renderReport(done)).not.toMatch(/Цикл неповний/);
  });

  it('рядок розбіжності несе і сторінку витягу, і source_url матриці', () => {
    const cycle = {
      month: '2026-08',
      status: 'completed',
      checks: [
        {
          rule_id: 'common.minimum_wage',
          state: 'divergence',
          matrix_value: 4806,
          fetched_value: 5000,
          diff_percent: 4.04,
          failure_reason: null,
          fetched_from: 'https://www.zus.pl/baza-wiedzy/skladki',
          source_url: 'https://www.zus.pl/en/-/nowe-wysokosci',
          verified_at: '2026-07-18',
        },
      ],
    };
    const out = renderReport(cycle);
    expect(out).toContain('https://www.zus.pl/baza-wiedzy/skladki');
    expect(out).toContain('https://www.zus.pl/en/-/nowe-wysokosci');
  });
});
