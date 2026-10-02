import { describe, it, expect } from 'vitest';

import { canReverify, classifyOutcome, fingerprint, updateStreaks, RETRY_DAYS } from './outcome.mjs';
import { STATES } from './states.mjs';

const field = (state, extra = {}) => ({ param: 'x', state, method: 'page', fetched_value: 1, ...extra });
const check = (rule_id, state, extra = {}) => ({ rule_id, state, fields: [field(state)], ...extra });

describe('canReverify — кому бот може дати нову дату', () => {
  it('збіг і косметична відмінність — так: число те саме', () => {
    expect(canReverify(check('a', STATES.MATCH))).toBe(true);
    expect(canReverify(check('a', STATES.COSMETIC))).toBe(true);
  });

  it.each([STATES.DIVERGENCE, STATES.NEEDS_CONFIRMATION, STATES.UNAVAILABLE, STATES.OUT_OF_SCOPE, STATES.NOT_VERIFIED])(
    '%s — ні',
    (state) => expect(canReverify(check('a', state))).toBe(false),
  );

  // DECISIONS 2026-10-01 (сесія 03): дата підтверджувала б неперевірене.
  it('правило з manual-листом — ні, навіть коли решта збіглась', () => {
    expect(canReverify(check('a', STATES.MATCH, { manual: ['price'] }))).toBe(false);
  });

  it('запис легкого прогону (лише закони) — ні: чисел він не порівнював', () => {
    expect(canReverify(check('a', STATES.MATCH, { laws_only: true }))).toBe(false);
  });

  it('відхилений вхід — ні', () => {
    expect(canReverify(check('a', STATES.MATCH, { blocked: true }))).toBe(false);
  });

  // Агрегат бере найгірше поле, але право на дату не має залежати від порядку SEVERITY.
  it('поле не в збігу при «збігається» на правилі — ні', () => {
    expect(canReverify({ rule_id: 'a', state: STATES.MATCH, fields: [field(STATES.MATCH), field(STATES.UNAVAILABLE)] })).toBe(false);
  });
});

describe('classifyOutcome — кожне правило рівно в одному кошику', () => {
  const cycle = {
    checks: [
      check('match', STATES.MATCH),
      check('cosmetic', STATES.COSMETIC),
      check('div', STATES.DIVERGENCE),
      check('act', STATES.NEEDS_CONFIRMATION),
      check('down', STATES.UNAVAILABLE),
      check('waf', STATES.UNAVAILABLE, { blocked: true }),
      check('manual', STATES.MATCH, { manual: ['p'] }),
    ],
  };
  const out = classifyOutcome(cycle);

  it('збіг — у бот-PR', () => expect(out.reverify).toEqual(['match', 'cosmetic']));

  it('розбіжність, змінений закон, відхилений вхід і збіг без права на дату — людині', () => {
    expect(out.attention.map((c) => c.rule_id)).toEqual(['div', 'act', 'waf', 'manual']);
  });

  // Відхилений вхід — не погода: йому повтори не належать (cycle.mjs, статус blocked).
  it('недоступне — у повтор, відхилений вхід — ні', () => expect(out.unavailable.map((c) => c.rule_id)).toEqual(['down']));

  it('жодне правило не загубилось і не задвоїлось', () => {
    const all = [...out.reverify, ...out.attention.map((c) => c.rule_id), ...out.unavailable.map((c) => c.rule_id)];
    expect(all.sort()).toEqual(cycle.checks.map((c) => c.rule_id).sort());
  });
});

describe('fingerprint — та сама знахідка не будить людину двічі', () => {
  const a = { rule_id: 'r', state: STATES.NEEDS_CONFIRMATION, amended: [{ id: 'DU/2026/1' }], fields: [] };

  it('не залежить від порядку записів і від часу прогону', () => {
    const b = check('q', STATES.DIVERGENCE);
    expect(fingerprint([a, b])).toBe(fingerprint([b, { ...a, started_at: 'інший час' }]));
  });

  it('нова зміна акта — новий відбиток', () => {
    expect(fingerprint([a])).not.toBe(fingerprint([{ ...a, amended: [{ id: 'DU/2026/1' }, { id: 'DU/2026/2' }] }]));
  });

  it('інше значення джерела — новий відбиток', () => {
    const d = (v) => ({ rule_id: 'r', state: STATES.DIVERGENCE, fetched_value: v, fields: [field(STATES.DIVERGENCE, { fetched_value: v })] });
    expect(fingerprint([d(4806)])).not.toBe(fingerprint([d(4950)]));
  });
});

describe('updateStreaks — три дні поспіль, потім людині', () => {
  it(`${RETRY_DAYS}-й день поспіль — до людини; раніше — ні`, () => {
    let s = updateStreaks({}, ['r'], '2026-10-01');
    expect(s.overdue).toEqual([]);
    s = updateStreaks(s.streaks, ['r'], '2026-10-02');
    expect(s.overdue).toEqual([]);
    s = updateStreaks(s.streaks, ['r'], '2026-10-03');
    expect(s.overdue).toEqual(['r']);
    expect(s.streaks.r).toEqual({ since: '2026-10-01', days: 3, lastDay: '2026-10-03' });
  });

  it('два прогони за день — один день', () => {
    const first = updateStreaks({}, ['r'], '2026-10-01');
    expect(updateStreaks(first.streaks, ['r'], '2026-10-01').streaks.r.days).toBe(1);
  });

  it('джерело відповіло — лічильник зникає', () => {
    const first = updateStreaks({}, ['r'], '2026-10-01');
    expect(updateStreaks(first.streaks, [], '2026-10-02').streaks).toEqual({});
  });
});
