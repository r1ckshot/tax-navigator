import { describe, it, expect } from 'vitest';

import { runCycle, SAME_DOMAIN_PAUSE_MS } from './cycle.mjs';
import { STATES } from './states.mjs';

const NOW = new Date('2026-09-16T08:00:00Z');

describe('пауза між запитами до одного домену (sad.md §4 стовп 2, QG-4)', () => {
  const rule = (rule_id) => ({ rule_id, params: { monthly: 4806 }, source_url: 'https://www.zus.pl/x', verified_at: '2026-07-18' });
  const extractorAt = (url) => ({ url, matrixValue: (p) => p.monthly, extract: (html) => html });

  /**
   * Годинник і сон підставні: тест бачить, скільки цикл ЗБИРАВСЯ чекати, і не
   * чекає насправді. Кожен запит «триває» 300 мс, щоб перевірити відлік від
   * кінця попереднього запиту, а не від його початку.
   */
  function harness() {
    let now = 0;
    const slept = [];
    return {
      slept,
      clock: () => now,
      sleep: async (ms) => {
        slept.push(ms);
        now += ms;
      },
      fetchImpl: async () => {
        now += 300;
        return { ok: true, status: 200, text: async () => '4806' };
      },
    };
  }

  it('два запити до zus.pl і www.zus.pl — одна пауза, повна, від кінця першого запиту', async () => {
    const h = harness();
    const cycle = await runCycle({
      rules: [rule('a'), rule('b')],
      now: NOW,
      extractors: { a: extractorAt('https://zus.pl/one'), b: extractorAt('https://www.zus.pl/two') },
      ...h,
    });
    expect(h.slept).toEqual([SAME_DOMAIN_PAUSE_MS]);
    expect(cycle.checks.map((c) => c.state)).toEqual([STATES.MATCH, STATES.MATCH]);
  });

  it('різні домени — без паузи', async () => {
    const h = harness();
    await runCycle({
      rules: [rule('a'), rule('b')],
      now: NOW,
      extractors: { a: extractorAt('https://www.zus.pl/one'), b: extractorAt('https://www.podatki.gov.pl/two') },
      ...h,
    });
    expect(h.slept).toEqual([]);
  });

  it('час, що вже минув між запитами, віднімається від паузи', async () => {
    // zus.pl (300 мс) → podatki.gov.pl (1500 мс) → знову zus.pl: від кінця
    // першого запиту минуло 1500 мс, тож лишається дочекати 500.
    let now = 0;
    const slept = [];
    await runCycle({
      rules: [rule('a'), rule('c'), rule('b')],
      now: NOW,
      extractors: {
        a: extractorAt('https://www.zus.pl/one'),
        c: extractorAt('https://www.podatki.gov.pl/slow'),
        b: extractorAt('https://www.zus.pl/two'),
      },
      clock: () => now,
      sleep: async (ms) => {
        slept.push(ms);
        now += ms;
      },
      fetchImpl: async (url) => {
        now += url.includes('podatki') ? 1500 : 300;
        return { ok: true, status: 200, text: async () => '4806' };
      },
    });
    expect(slept).toEqual([SAME_DOMAIN_PAUSE_MS - 1500]);
  });

  it('недоступне джерело теж рахується запитом: пауза після падіння лишається', async () => {
    const h = harness();
    let call = 0;
    await runCycle({
      rules: [rule('a'), rule('b')],
      now: NOW,
      extractors: { a: extractorAt('https://www.zus.pl/one'), b: extractorAt('https://www.zus.pl/two') },
      clock: h.clock,
      sleep: h.sleep,
      fetchImpl: async () => {
        call += 1;
        if (call === 1) throw new Error('ECONNRESET');
        return h.fetchImpl();
      },
    });
    expect(h.slept).toEqual([SAME_DOMAIN_PAUSE_MS]);
  });
});
