import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ANNOUNCEMENTS, findYearAhead, futureAmendments, searchUrl } from './year-ahead.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (id) => readFileSync(join(HERE, '__fixtures__', 'eli-search', `${id}.json`), 'utf8');
const { rules } = JSON.parse(readFileSync(join(HERE, '../../app/lib/rules/rules.2026.json'), 'utf8'));

/** Пошук ELI, знятий 2026-10-01: відповідь за оголошенням, чий URL питають. */
const fixtureFetch = async (url) => {
  const a = ANNOUNCEMENTS.find((x) => searchUrl(x) === url);
  return a ? { ok: true, status: 200, text: async () => fixture(a.id) } : { ok: false, status: 404, text: async () => '' };
};

describe('оголошення наступного року — фікстури ELI 2026-10-01', () => {
  // Еталон: на 2026-10-01 в ELI вже є rozporządzenie про мінімалку на 2027
  // (DU/2026/1213, опубліковано 15.09.2026); обвіщення про 30-krotność на 2027
  // ще немає (торішнє — 19.11.2025), обвіщення GUS за IV кв. 2026 — теж (січень).
  it('матриця 2026: знайдено лише мінімалку 2027', async () => {
    const { found, unavailable } = await findYearAhead({ taxYear: 2026, fetchImpl: fixtureFetch });
    expect(unavailable).toEqual([]);
    expect(found.map((f) => [f.id, f.eli, f.year])).toEqual([['minimum_wage', 'DU/2026/1213', 2027]]);
  });

  // Ті самі фікстури для матриці 2025 мусять бачити всі три оголошення на 2026 —
  // інакше регулярка року тримається не за те місце в назві.
  it('матриця 2025: усі три оголошення на 2026 і мінімалка 2027', async () => {
    const { found } = await findYearAhead({ taxYear: 2025, fetchImpl: fixtureFetch });
    const ids = found.map((f) => `${f.id}:${f.year}:${f.eli}`).sort();
    expect(ids).toEqual(
      ['contribution_cap:2026:MP/2025/1206', 'minimum_wage:2026:DU/2025/1242', 'minimum_wage:2027:DU/2026/1213', 'zdrowotna_base:2026:MP/2026/117'].sort(),
    );
  });

  // GUS публікує зарплату за кожен квартал: лише IV квартал — база наступного року.
  it('обвіщення GUS за інші квартали не рахуються', async () => {
    const a = ANNOUNCEMENTS.find((x) => x.id === 'zdrowotna_base');
    expect(a.forYear('… w drugim kwartale 2026 r.')).toBeNull();
    expect(a.forYear('… w czwartym kwartale 2026 r.')).toBe(2027);
  });

  it('пошук, що не вдався, — названа причина, а не «нічого не знайдено»', async () => {
    const { found, unavailable } = await findYearAhead({ taxYear: 2026, fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }) });
    expect(found).toEqual([]);
    expect(unavailable.map((u) => u.id)).toEqual(ANNOUNCEMENTS.map((a) => a.id));
    expect(unavailable.every((u) => u.failure_reason)).toBe(true);
  });

  it('кожне оголошення вказує на справжні правила матриці', () => {
    const ids = rules.map((r) => r.rule_id);
    for (const a of ANNOUNCEMENTS) expect(a.rules.filter((id) => !ids.includes(id)), a.id).toEqual([]);
  });
});

describe('futureAmendments — зміни актів, чинні з наступного року', () => {
  const cycle = {
    checks: [
      {
        rule_id: 'a',
        amended: [{ id: 'DU/2026/1098', effective: '2027-01-01', title: 'OKI' }, { id: 'DU/2026/846', effective: '2026-10-01' }],
        fields: [{ rule_id: 'a', amended: [{ id: 'DU/2026/1123', effective: '2028-01-01', title: 'żłobki' }] }],
      },
      { rule_id: 'b', amended: [{ id: 'DU/2026/1098', effective: '2027-01-01', title: 'OKI' }] },
    ],
  };

  it('лише чинні з 01.01 наступного року; одна зміна — один запис з усіма правилами', () => {
    expect(futureAmendments(cycle, 2026)).toEqual([
      { id: 'DU/2026/1098', title: 'OKI', effective: '2027-01-01', rules: ['a', 'b'] },
      { id: 'DU/2026/1123', title: 'żłobki', effective: '2028-01-01', rules: ['a'] },
    ]);
  });
});
