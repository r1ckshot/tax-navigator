import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCycle, monthOf, writeReport } from './cycle.mjs';
import { renderReport, summaryLine } from './report.mjs';
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
const closedHost = {
  rule_id: 'jdg.liniowy',
  params: { rate: 0.19 },
  source_url: 'https://www.podatki.gov.pl/x',
  verified_at: '2026-07-18',
};

const PAGE = { method: 'page', why: 'тестова сторінка' };
const methods = {
  'common.minimum_wage': PAGE,
  'residency.treaty_tiebreakers': { method: 'act', why: 'тестовий акт' },
  'jdg.liniowy': PAGE,
};
/** Сторінка-рядок: `kwota: <значення>`. Сирий рядок береться як є, без валюти. */
const KWOTA = { kind: 'number', after: [/kwota:/], value: /\d[\d ,.]*(?:zł)?/, within: 40 };
const pages = {
  'common.minimum_wage': { url: 'https://www.zus.pl/test', fields: { monthly: KWOTA } },
  // Сторінка на хості поза SCRIPTABLE_HOSTS: AC-02 перевіряє URL, який цикл відкрив би.
  'jdg.liniowy': { url: 'https://isap.sejm.gov.pl/x', fields: { rate: KWOTA } },
};

const okFetch = (body) => async () => ({ ok: true, status: 200, text: async () => body });

describe('runCycle: кожне правило виходить рівно з одним станом', () => {
  it('чотири правила — чотири записи, усі стани валідні', async () => {
    const cycle = await runCycle({
      rules: [inScope, wafSource, neverVerified, closedHost],
      now: NOW,
      fetchImpl: okFetch('kwota: 4806'),
      pages,
      methods,
      laws: {},
    });
    expect(cycle.checks).toHaveLength(4);
    expect(cycle.checks.map((c) => c.state)).toEqual([
      STATES.MATCH,
      STATES.OUT_OF_SCOPE,
      STATES.NOT_VERIFIED,
      STATES.OUT_OF_SCOPE,
    ]);
  });

  it('спосіб, який цикл не виконує, названо в причині, а не схованим «поза скоупом»', async () => {
    const manual = { ...methods, 'residency.treaty_tiebreakers': { method: 'manual', why: 'тест' } };
    const cycle = await runCycle({ rules: [wafSource], now: NOW, fetchImpl: okFetch(''), pages, methods: manual });
    expect(cycle.checks[0].state).toBe(STATES.OUT_OF_SCOPE);
    expect(cycle.checks[0].failure_reason).toBe('спосіб звірки «manual» цикл не виконує');
  });

  it('act без опису законів — out_of_scope з причиною, а не мовчазний пропуск', async () => {
    const cycle = await runCycle({ rules: [wafSource], now: NOW, fetchImpl: okFetch(''), pages, methods, laws: {} });
    expect(cycle.checks[0].state).toBe(STATES.OUT_OF_SCOPE);
    expect(cycle.checks[0].failure_reason).toMatch(/немає опису джерела/);
  });

  it('правило без запису в реєстрі способів не зникає, а отримує стан із причиною', async () => {
    const cycle = await runCycle({ rules: [inScope], now: NOW, fetchImpl: okFetch('kwota: 4806'), pages, methods: {} });
    expect(cycle.checks[0].state).toBe(STATES.OUT_OF_SCOPE);
    expect(cycle.checks[0].failure_reason).toMatch(/немає способу звірки/);
  });

  /**
   * zus.pl обслуговує вісім правил. Вісім однакових запитів поспіль — та сама
   * поведінка бота, від якої стоїть пауза між запитами.
   */
  it('одна сторінка на кілька правил тягнеться раз за цикл', async () => {
    const shared = {
      'common.minimum_wage': { url: 'https://www.zus.pl/test', fields: { monthly: KWOTA } },
      'jdg.liniowy': { url: 'https://www.zus.pl/test', fields: { rate: { ...KWOTA, after: [/stawka:/] } } },
    };
    let calls = 0;
    const cycle = await runCycle({
      rules: [inScope, closedHost],
      now: NOW,
      pages: shared,
      methods,
      fetchImpl: async () => {
        calls += 1;
        return { ok: true, status: 200, text: async () => 'kwota: 4806 stawka: 0.19' };
      },
    });
    expect(calls).toBe(1);
    expect(cycle.checks.map((c) => c.state)).toEqual([STATES.MATCH, STATES.MATCH]);
  });

  it('косметика не читається як розбіжність', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch('kwota: 4 806,00 zł'),
      pages,
      methods,
    });
    expect(cycle.checks[0].state).toBe(STATES.COSMETIC);
    expect(cycle.status).toBe('completed');
  });

  it('інше число — розбіжність із відсотком', async () => {
    const cycle = await runCycle({
      rules: [inScope],
      now: NOW,
      fetchImpl: okFetch('kwota: 5 000,00 zł'),
      pages,
      methods,
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
      pages,
      methods,
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
      pages,
      methods,
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
    await expect(
      runCycle({
        rules: [inScope],
        now: NOW,
        fetchImpl: okFetch('kwota: 4806'),
        pages,
        methods,
        // діагностичний гачок: підміняє стан уже після diff, як зробила б
        // регресія в будь-якому з трьох модулів, що присвоюють стани
        mutate: (check) => ({ ...check, state: 'ok' }),
      })
    ).rejects.toThrow(/без валідного стану/);
  });

  /**
   * Пара входів як постійна перевірка (урок 11.1). Обидва прогони йдуть через
   * СПРАВЖНІЙ реєстр `PAGES`, а не через підставний: перевірка стоїть
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
    // Дві різні сторінки: одна й та сама тягнулась би раз на цикл, і другий
    // запис просто повторив би перший.
    const twoPages = {
      'common.minimum_wage': { url: 'https://www.zus.pl/one', fields: { monthly: KWOTA } },
      'jdg.liniowy': { url: 'https://www.zus.pl/two', fields: { rate: KWOTA } },
    };
    let call = 0;
    const cycle = await runCycle({
      rules: [inScope, closedHost],
      now: NOW,
      pages: twoPages,
      methods,
      pauseMs: 0,
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
        fetchImpl: okFetch('kwota: 4806'),
        pages,
        methods,
        drop: true,
      })
    ).rejects.toThrow(/жоден не має зникнути/);
  });
});

describe('writeReport: місячний звіт лишається файлом', () => {
  it('пише data/reports/YYYY-MM.md з тим самим текстом, що в stdout, і заміщає при повторі', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'monitor-')), 'reports');
    const first = await runCycle({ rules: [inScope], now: NOW, fetchImpl: okFetch('kwota: 5 000,00 zł'), pages, methods });
    const path = writeReport(dir, first);

    expect(path).toBe(join(dir, '2026-09.md'));
    expect(readFileSync(path, 'utf8')).toBe(`${renderReport(first)}\n${summaryLine(first)}\n`);

    const second = await runCycle({ rules: [inScope], now: NOW, fetchImpl: okFetch('kwota: 4806'), pages, methods });
    writeReport(dir, second);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('розбіжностей 0');
    expect(text).not.toContain('5000');
  });
});

/**
 * Наскрізний прогін над справжньою матрицею, офлайн: сторінки, відповіді ELI і
 * zakon.rada — фікстури, зняті 2026-10-01. Питання одне — «Готово коли» сесії
 * 03: кожне з 26 правил виходить з автоматичним станом, жодне не лишається
 * `out_of_scope`.
 */
describe('runCycle: 26 з 26 на фікстурах 2026-10-01', async () => {
  const { URLS } = await import('./pages.mjs');
  const { rules } = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../app/lib/rules/rules.2026.json'), 'utf8'));
  const PAGE_FILES = Object.fromEntries(Object.entries(URLS).map(([key, url]) => [url, join('pages', `${key}.html`)]));

  const { EDITIONS } = await import('./laws.mjs');
  const DOCUMENT_FILES = { [EDITIONS.objasnieniaRezydencja.url]: join('documents', 'objasnienia-rezydencja-2021.pdf') };

  function fixtureFetch(url) {
    if (DOCUMENT_FILES[url]) {
      const bytes = readFileSync(join(FIXTURES, DOCUMENT_FILES[url]));
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    }
    const eliId = /\/eli\/acts\/(.+)$/.exec(url)?.[1];
    const radaId = /\/laws\/show\/(.+)$/.exec(url)?.[1];
    const file = PAGE_FILES[url] ?? (eliId ? join('eli', `${eliId.replaceAll('/', '-')}.json`) : radaId ? join('rada', `${radaId}.html`) : null);
    try {
      const body = fixture(file);
      return { ok: true, status: 200, text: async () => body };
    } catch {
      return { ok: false, status: 404, text: async () => '' };
    }
  }

  const cycle = await runCycle({ rules, now: new Date('2026-10-01T12:00:00Z'), fetchImpl: async (url) => fixtureFetch(url), pauseMs: 0 });
  const byState = (state) => cycle.checks.filter((c) => c.state === state).map((c) => c.rule_id).sort();

  it('26 записів, жодного поза автозвіркою, недоступного чи розбіжного', () => {
    expect(cycle.checks).toHaveLength(26);
    expect(byState(STATES.OUT_OF_SCOPE)).toEqual([]);
    expect(byState(STATES.UNAVAILABLE)).toEqual([]);
    expect(byState(STATES.DIVERGENCE)).toEqual([]);
  });

  /**
   * Еталон виведено вручну з фікстур ELI і rada (`laws.test.mjs` — правило
   * відбору). Після липневих звірок змінились: ustawa o PIT (чотири зміни з
   * 08-10 по 08-25 і DU/2026/846, чинна з 10-01), ustawa o świadczeniach
   * (три зміни, опубліковані 07-21…07-27), ustawa o ryczałcie (DU/2026/1098,
   * опублікована 08-18) і ПКУ (редакція 17.09.2026). Без змін: конвенція
   * PL-UA, Prawo przedsiębiorców і ustawa o sus (їхні зміни опубліковані до
   * звірок і чинні лише з 10-14, 11-01 і 2028). `jdg.byly_pracodawca`
   * перезвірено 2026-10-01 — після цього змін немає.
   */
  it('потребують підтвердження рівно правила, чиї закони змінились після звірки', () => {
    expect(byState(STATES.NEEDS_CONFIRMATION)).toEqual(
      [
        'fop.esv_vz',
        'fop.zaklad_in_pl',
        'incubator.kup',
        'jdg.liniowy',
        'jdg.skala',
        'jdg.zdrowotna.ryczalt',
        'nierejestrowana.pit',
        'residency.days_threshold',
        'residency.special_norm_52zr',
        'uop.employee_contributions',
        'zlecenie.contributions',
        'zlecenie.kup',
      ].sort(),
    );
  });

  it('звіт називає зміни поіменно і розкладає «збігається» за способом', () => {
    const report = renderReport(cycle);
    expect(report).toContain('зміна DU/2026/1079: опубліковано 2026-08-10');
    // Перелік змін — раз на акт, а не в кожному з восьми правил на ustawie o PIT.
    expect(report.split('зміна DU/2026/1079:').length - 1).toBe(1);
    expect(report).toContain('нова редакція від 2026-09-17');
    expect(report).toMatch(/сторінкою — \d+, актом без змін — \d+/);
    // jdg.byly_pracodawca перезвірено 2026-10-01, у день циклу: це ручна звірка, не «акт без змін».
    expect(report).toContain('звірено вручну в день циклу — 1');
    expect(report).toContain('- incubator.kup:');
    // Акт не покриває ціни абонементу: перед перечитанням закону людина має це знати.
    expect(report).toContain('не звіряються циклом (manual): subscriptionMonthlyMin');
  });

  /**
   * Рев'ю звіту 2026-10 (drift-reviewer): `jdg.zus.stages` «збігається сторінкою»,
   * але три його строки підтвердив лише незмінений акт. Звіт мусить це назвати,
   * а запис — нести `compared: false`.
   */
  it('листи page-правила, підтверджені лише актом, названо; запис несе compared: false', () => {
    const report = renderReport(cycle);
    expect(report).toContain('- jdg.zus.stages: ulgaNaStartMonths, preferencyjnyMonths, priorBusinessLookbackMonths');
    const stages = cycle.checks.find((c) => c.rule_id === 'jdg.zus.stages');
    const actFields = stages.fields.filter((f) => f.method === 'act');
    expect(actFields.map((f) => [f.state, f.compared])).toEqual(Array(3).fill([STATES.MATCH, false]));
  });
});
