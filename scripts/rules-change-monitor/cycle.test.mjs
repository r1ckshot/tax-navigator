import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCycle, monthOf } from './cycle.mjs';
import { renderReport } from './report.mjs';
import { STATES, ALL_STATES } from './states.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8');

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

  /**
   * Пара входів як постійна перевірка (урок 11.1). Обидва прогони йдуть через
   * СПРАВЖНІЙ екстрактор `EXTRACTORS`, а не через підставний: перевірка стоїть
   * між фетчем і витягом, і підмінений екстрактор не довів би, що вона там.
   */
  it('шкідливий вхід: сторінка з прихованою інструкцією не доїжджає до витягу', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch(fixture('zus-skladki-poisoned.html')),
    });
    expect(cycle.checks[0].blocked).toBe(true);
    expect(cycle.checks[0].state).toBe(STATES.UNAVAILABLE);
    expect(cycle.checks[0].fetched_value).toBeNull();
    expect(cycle.status).toBe('blocked');

    // Наскрізна асерція, і вона про те, чого в звіті НЕМАЄ. Звіт читає
    // `drift-reviewer`: доїде туди наказ дослівно — перевірка сама стане
    // каналом доставки, який ми щойно перекрили. Перевіряється на справжньому
    // ланцюгу фетч → перевірка → запис → звіт, а не на зібраному руками записі.
    const report = renderReport(cycle);
    for (const word of ['ignore all previous', 'OAUTH', 'collector.example', '3200', 'rules.2026.json']) {
      expect(report.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('безпечний вхід: та сама сторінка зі зміненою ставкою дає розбіжність', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch(fixture('zus-skladki-raised.html')),
    });
    expect(cycle.checks[0].blocked).toBeUndefined();
    expect(cycle.checks[0].state).toBe(STATES.DIVERGENCE);
    expect(cycle.checks[0].fetched_value).toBe(4950);
    expect(cycle.status).toBe('completed');
  });

  /**
   * `blocked` не має права розчинитись у загальному `partial`: недоступне
   * джерело і відхилений вхід вимагають різної реакції людини.
   */
  it('заблокований вхід переважує недоступне джерело у статусі циклу', async () => {
    let call = 0;
    const cycle = await runCycle({
      rules: [inScope, inScope],
      now: NOW,
      fetchImpl: async () => {
        call += 1;
        if (call === 1) throw new Error('ECONNRESET');
        return { ok: true, status: 200, text: async () => fixture('zus-skladki-poisoned.html') };
      },
    });
    expect(cycle.checks.map((c) => c.blocked)).toEqual([undefined, true]);
    expect(cycle.status).toBe('blocked');
  });

  /**
   * Тихо обрізаний вхід читався б як «джерело мовчало»: стан однаковий,
   * причина різна. Різницю має бачити людина, а не лише код.
   */
  it('обрізаний вхід називає обрізання причиною, а не порожнечу', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch('<p>нічого схожого на ставку</p>'.padEnd(1_500_001, ' ')),
    });
    expect(cycle.checks[0].state).toBe(STATES.UNAVAILABLE);
    expect(cycle.checks[0].failure_reason).toMatch(/обрізано за стелею/);
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
