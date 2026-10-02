import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ANNOUNCEMENTS } from './year-ahead.mjs';
import { HOT_MONTHS, amendmentIds, attentionIssue, lawsFingerprint, marker, planRun, radaIds, radaText, writeOutcome } from './workflow.mjs';
import { STATES } from './states.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('planRun — розклад', () => {
  // 2026-10-05 — понеділок (жовтень гарячий), 2026-08-03 — понеділок (серпень ні).
  it.each([
    ['2026-08-01', 0, 'full'],
    ['2026-08-03', 0, 'laws-only'],
    ['2026-08-04', 0, 'skip'],
    ['2026-08-04', 2, 'full'],
    ['2026-10-05', 0, 'full'],
    ['2026-10-06', 0, 'skip'],
    ['2027-01-04', 0, 'full'],
  ])('%s, джерел у повторі %i → %s', (date, pendingRetries, mode) => {
    expect(planRun({ date, event: 'schedule', pendingRetries }).mode).toBe(mode);
  });

  it('ручний запуск бере режим із вводу, без вводу — повний', () => {
    expect(planRun({ date: '2026-08-04', event: 'workflow_dispatch', requested: 'drill' }).mode).toBe('drill');
    expect(planRun({ date: '2026-08-04', event: 'workflow_dispatch', requested: 'auto' }).mode).toBe('full');
  });
});

/**
 * Гарячі місяці виведено з дат публікацій в ELI. Тест читає ті самі фікстури: якщо
 * оголошення колись вийде поза вікном, падає тут, а не мовчки пропускає тиждень.
 */
describe('HOT_MONTHS покриває кожну публікацію з фікстур ELI', () => {
  for (const a of ANNOUNCEMENTS) {
    it(a.id, () => {
      const { items } = JSON.parse(readFileSync(join(HERE, '__fixtures__', 'eli-search', `${a.id}.json`), 'utf8'));
      const months = items.filter((i) => a.forYear(i.title) !== null).map((i) => Number(i.promulgation.slice(5, 7)));
      expect(months.length).toBeGreaterThan(0);
      expect(months.filter((m) => !HOT_MONTHS.includes(m))).toEqual([]);
    });
  }
});

const div = {
  rule_id: 'common.minimum_wage',
  state: STATES.DIVERGENCE,
  fetched_value: 4950,
  matrix_value: 4806,
  verified_at: '2026-07-18',
  fields: [{ param: 'monthly', state: STATES.DIVERGENCE, fetched_value: 4950, matrix_value: 4806, fetched_from: 'https://www.zus.pl/x' }],
};
const act = {
  rule_id: 'jdg.skala',
  state: STATES.NEEDS_CONFIRMATION,
  verified_at: '2026-07-18',
  fields: [
    { param: 'kwota', state: STATES.MATCH },
    { param: 'zdrowotnaRate', state: STATES.NEEDS_CONFIRMATION, amended: [{ id: 'DU/2026/1', effective: '2026-09-01' }], fetched_from: 'https://api.sejm.gov.pl/eli/acts/DU/2004/2135' },
  ],
};
const match = { rule_id: 'uop.pit', state: STATES.MATCH, fields: [{ param: 'x', state: STATES.MATCH }] };
const down = { rule_id: 'nierejestrowana.limit', state: STATES.UNAVAILABLE, failure_reason: 'запит не вдався', fetched_from: 'https://www.biznes.gov.pl/pl/portal/00115', fields: [] };

describe('attentionIssue — таблиця для людини', () => {
  const issue = attentionIssue({ checks: [div, act], date: '2026-10-02', runUrl: 'https://run' });

  it('маркер відбитка першим рядком — за ним workflow знаходить свій issue', () => {
    expect(issue.body.split('\n')[0]).toBe(marker(issue.fingerprint));
  });

  it('рядок на кожен лист, що не збігся: значення джерела, матриці, звідки, дата', () => {
    expect(issue.body).toContain('| `common.minimum_wage` | monthly | розбіжність | 4950 | 4806 | https://www.zus.pl/x |');
    expect(issue.body).toContain('| `jdg.skala` | zdrowotnaRate | закон змінився |');
    expect(issue.body).toContain('DU/2026/1 (чинна з 2026-09-01)');
    expect(issue.body).not.toContain('| kwota |');
  });

  it('символ | у тексті джерела не ламає таблицю', () => {
    const body = attentionIssue({ checks: [{ ...div, fields: [{ ...div.fields[0], fetched_from: 'a|b' }] }], date: 'd', runUrl: 'r' }).body;
    expect(body).toContain('a\\|b');
  });
});

describe('writeOutcome — файли для workflow', () => {
  const run = (cycle, stateIn = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'outcome-'));
    const out = writeOutcome({ cycle, yearAhead: { found: [] }, stateIn, date: '2026-10-02', taxYear: 2026, runUrl: 'r', dir });
    return { out, dir, read: (f) => readFileSync(join(dir, f), 'utf8'), has: (f) => existsSync(join(dir, f)) };
  };

  it('повний прогін: бот-PR, issue людині, перший день повтору', () => {
    const { out, read, has } = run({ checks: [match, div, act, down] });
    expect(read('reverify.txt')).toBe('uop.pit\n');
    expect(out).toMatchObject({ reverify: '1', attention: '2', overdue: '0', pending_retries: '1', next_year: '0' });
    expect(JSON.parse(read('attention-full.json')).map((c) => c.rule_id)).toEqual(['common.minimum_wage', 'jdg.skala']);
    // Агенту — стислий запис: лише листи, що не збіглись, і зміни актів раз на всіх.
    const forAgent = JSON.parse(read('attention.json'));
    expect(forAgent.rules.map((r) => [r.rule_id, r.fields.map((f) => f.param)])).toEqual([
      ['common.minimum_wage', ['monthly']],
      ['jdg.skala', ['zdrowotnaRate']],
    ]);
    expect(forAgent.rules[1].fields[0].amended).toEqual(['DU/2026/1']);
    expect(forAgent.amendments['DU/2026/1']).toMatchObject({ effective: '2026-09-01' });
    expect(has('overdue.md')).toBe(false);
  });

  it('третій день мовчання — issue «перевір руками»', () => {
    const streaks = { 'nierejestrowana.limit': { since: '2026-09-30', days: 2, lastDay: '2026-10-01' } };
    const { out, read } = run({ checks: [down] }, { streaks });
    expect(out.overdue).toBe('1');
    expect(read('overdue.md')).toContain('| `nierejestrowana.limit` | https://www.biznes.gov.pl/pl/portal/00115 | запит не вдався | 2026-09-30 |');
  });

  it('легкий прогін не відкриває бот-PR і не рахує днів мовчання', () => {
    const { out, read } = run({ mode: 'laws-only', checks: [match, act, down] });
    expect(read('reverify.txt')).toBe('');
    expect(out).toMatchObject({ reverify: '0', attention: '1', pending_retries: '0' });
  });

  /**
   * Ескалація легкого прогону: нова зміна закону — повний прогін того ж дня; та
   * сама, що вже бачили (відбиток у стані), — ні, інакше 12 непідтверджених
   * правил будили б повний прогін щопонеділка.
   */
  it('легкий прогін ескалює лише на нові зміни законів', () => {
    const light = { mode: 'laws-only', checks: [act] };
    const seen = lawsFingerprint({ checks: [act] });
    expect(run(light).out.escalate).toBe('true');
    expect(run(light, { laws_fp: seen }).out.escalate).toBe('false');
    const newer = { ...act, fields: [{ ...act.fields[1], amended: [{ id: 'DU/2026/2', effective: '2026-11-01' }] }] };
    expect(run({ mode: 'laws-only', checks: [newer] }, { laws_fp: seen }).out.escalate).toBe('true');
    expect(run({ checks: [act] }).out.escalate).toBe('false');
  });

  it('стан: відбиток законів зберігається, навчання його не зсуває', () => {
    expect(JSON.parse(run({ checks: [act] }).read('state.json')).laws_fp).toBe(lawsFingerprint({ checks: [act] }));
    const drilled = run({ drill: { rule_id: 'common.minimum_wage' }, checks: [div, act] }, { laws_fp: 'old' });
    expect(JSON.parse(drilled.read('state.json')).laws_fp).toBe('old');
  });

  it('навчання: лише навчальне правило, без бот-PR і без сигналу наступного року', () => {
    const amended = { ...act, amended: [{ id: 'DU/2026/1098', effective: '2027-01-01' }] };
    const { out, read } = run({ drill: { rule_id: 'common.minimum_wage' }, checks: [match, div, amended, down] });
    expect(out).toMatchObject({ reverify: '0', attention: '1', next_year: '0', overdue: '0' });
    expect(read('attention.md')).toContain('Навчання');
  });

  it('зміна акта, чинна з наступного року, — issue rules-2027', () => {
    const amended = { ...act, amended: [{ id: 'DU/2026/1098', effective: '2027-01-01', title: 'OKI' }] };
    const { out, read } = run({ checks: [amended] });
    expect(out.next_year).toBe('1');
    expect(read('next-year-title.txt')).toBe('rules-2027: значення й закони 2027 опубліковано');
    expect(read('next-year.md')).toContain('[DU/2026/1098](https://api.sejm.gov.pl/eli/acts/DU/2026/1098) — чинна з 2027-01-01');
  });

  it('без знахідок — жодного файла issue', () => {
    const { dir } = run({ checks: [match] });
    expect(readdirSync(dir).sort()).toEqual(['reverify.txt', 'state.json']);
  });
});

it('amendmentIds — зміни з правил і з їхніх листів, без повторів', () => {
  expect(amendmentIds([act, { rule_id: 'b', amended: [{ id: 'DU/2026/1' }, { id: 'DU/2026/7' }] }])).toEqual(['DU/2026/1', 'DU/2026/7']);
});

describe('закони України для агента', () => {
  const pku = (state) => ({ param: 'pku', state, fetched_from: 'https://zakon.rada.gov.ua/laws/show/2755-17' });

  it('radaIds — лише ті, чия редакція змінилась, без повторів', () => {
    const checks = [
      { rule_id: 'fop.esv_vz', fields: [pku(STATES.NEEDS_CONFIRMATION), { param: 'esv', state: STATES.NEEDS_CONFIRMATION, fetched_from: 'https://zakon.rada.gov.ua/laws/show/2464-17' }] },
      { rule_id: 'fop.zaklad_in_pl', fields: [pku(STATES.NEEDS_CONFIRMATION)] },
      { rule_id: 'x', fields: [{ ...pku(STATES.MATCH), fetched_from: 'https://zakon.rada.gov.ua/laws/show/4695-20' }] },
    ];
    expect(radaIds(checks)).toEqual(['2464-17', '2755-17']);
  });

  it('radaText — текст статей без розмітки й скриптів', () => {
    const html = '<html><script>var a=1</script><p>Стаття 293. Ставки&nbsp;єдиного податку</p><div>293.3. <b>5</b> відсотків</div></html>';
    const text = radaText(html);
    expect(text).toContain('Стаття 293. Ставки єдиного податку');
    expect(text).toContain('293.3. 5 відсотків');
    expect(text).not.toMatch(/var a|<p>/);
  });
});
