import { describe, it, expect } from 'vitest';
import { runCycle, monthOf } from './cycle.mjs';
import { STATES, ALL_STATES } from './states.mjs';

const NOW = new Date('2026-09-14T08:00:00Z');

const inScope = {
  rule_id: 'common.minimum_wage',
  params: { monthly: 4806 },
  source_url: 'https://www.zus.pl/baza-wiedzy/x',
  verified_at: '2026-07-18',
};
const wafSource = {
  rule_id: 'residency.treaty_tiebreakers',
  params: {},
  source_url: 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp',
  verified_at: '2026-07-18',
};
const neverVerified = {
  rule_id: 'draft.rule',
  params: { monthly: 1 },
  source_url: 'https://www.zus.pl/baza-wiedzy/x',
  verified_at: '',
};
const noExtractor = {
  rule_id: 'jdg.liniowy',
  params: { rate: 0.19 },
  source_url: 'https://www.podatki.gov.pl/x',
  verified_at: '2026-07-18',
};

const extractors = {
  'common.minimum_wage': {
    url: 'https://example.test/page',
    matrixValue: (params) => params.monthly,
    extract: (html) => html,
  },
};

const okFetch = (body) => async () => ({ ok: true, status: 200, text: async () => body });

describe('runCycle: кожне правило виходить рівно з одним станом', () => {
  it('чотири правила — чотири записи, усі стани валідні', async () => {
    const cycle = await runCycle({
      rules: [inScope, wafSource, neverVerified, noExtractor],
      now: NOW,
      fetchImpl: okFetch('4806'),
      extractors,
    });
    expect(cycle.checks).toHaveLength(4);
    expect(cycle.checks.map((c) => c.state)).toEqual([
      STATES.MATCH,
      STATES.OUT_OF_SCOPE,
      STATES.NOT_VERIFIED,
      STATES.OUT_OF_SCOPE,
    ]);
  });

  it('косметика не читається як розбіжність', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch('4 806,00 zł'),
      extractors,
    });
    expect(cycle.checks[0].state).toBe(STATES.COSMETIC);
    expect(cycle.status).toBe('completed');
  });

  it('інше число — розбіжність із відсотком', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch('5 000,00 zł'),
      extractors,
    });
    expect(cycle.checks[0].state).toBe(STATES.DIVERGENCE);
    expect(cycle.checks[0].diff_percent).toBeCloseTo(4.04, 2);
  });

  /**
   * Головна пастка цієї фічі: недоступне джерело НЕ має вийти зі станом
   * `match`. Тиша не є підтвердженням, і цикл мусить назватись partial.
   */
  it('джерело впало — unavailable і статус циклу partial, не «збігається»', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: async () => {
        throw new Error('ECONNRESET');
      },
      extractors,
    });
    expect(cycle.checks[0].state).toBe(STATES.UNAVAILABLE);
    expect(cycle.checks[0].fetched_value).toBeNull();
    expect(cycle.status).toBe('partial');
  });

  it('403 від джерела — теж unavailable, з кодом у причині', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => '' }),
      extractors,
    });
    expect(cycle.checks[0].state).toBe(STATES.UNAVAILABLE);
    expect(cycle.checks[0].failure_reason).toContain('403');
  });

  it('місяць циклу — ключ унікальності, у форматі YYYY-MM', () => {
    expect(monthOf(NOW)).toBe('2026-09');
  });

  /**
   * Інваріант AC-03 перевіряється на самому гейті, а не на виході `runCycle`:
   * той кидає на невалідному стані ще до повернення, тож асерція «усі стани
   * валідні» на його результаті не може впасти ніколи. Тавтологію знайшло
   * рев'ю з чистим контекстом; тут замість неї — доказ, що гейт спрацьовує.
   */
  it('стан поза переліком семи валить цикл, а не їде у звіт', async () => {
    const brokenExtractor = {
      'common.minimum_wage': {
        url: 'https://example.test/page',
        matrixValue: () => 4806,
        extract: () => '4806',
      },
    };
    await expect(
      runCycle({
        rules: [inScope],
        now: NOW,
        fetchImpl: okFetch('4806'),
        extractors: brokenExtractor,
        // діагностичний гачок: підміняє стан уже після diff, як зробила б
        // регресія в будь-якому з трьох модулів, що присвоюють стани
        mutate: (check) => ({ ...check, state: 'ok' }),
      })
    ).rejects.toThrow(/без валідного стану/);
  });

  it('жоден запис не має зникнути дорогою', async () => {
    await expect(
      runCycle({
        rules: [inScope, wafSource],
        now: NOW,
        fetchImpl: okFetch('4806'),
        extractors,
        drop: true,
      })
    ).rejects.toThrow(/жоден не має зникнути/);
  });
});
