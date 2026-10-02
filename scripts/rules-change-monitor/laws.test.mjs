import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pageText } from './extract.mjs';
import { createHash } from 'node:crypto';

import { act, amendmentsOf, checkAct, checkDocument, checkEdition, currentEdition, edition, isCandidate, isDocument, relevantAmendments } from './laws.mjs';
import { STATES } from './states.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Відповіді ELI, зняті 2026-10-01 (`__fixtures__/eli/`), обрізані до потрібних полів. */
const eli = (id) => JSON.parse(readFileSync(join(HERE, '__fixtures__', 'eli', `${id.replaceAll('/', '-')}.json`), 'utf8'));
/** Сторінки zakon.rada.gov.ua, зняті 2026-10-01. */
const rada = (id) => pageText(readFileSync(join(HERE, '__fixtures__', 'rada', `${id}.html`), 'utf8'));

/** Метадані зміни з фікстури; немає фікстури — як ELI, що не відповів. */
async function amendment(id) {
  try {
    const meta = eli(id);
    return { promulgation: meta.promulgation, title: meta.title };
  } catch {
    return { promulgation: null, title: null };
  }
}

const TODAY = '2026-10-01';
const ruleAt = (verified_at) => ({ rule_id: 'residency.days_threshold', params: {}, source_url: 'https://www.gov.pl/x', verified_at });
const PIT = act('pit', 'art. 3 ust. 2a');

describe('act: ustawa o PIT на справжній відповіді ELI 2026-10-01', () => {
  /**
   * Еталон виведено вручну з фікстури. Після 2026-07-18 набирають чинності
   * чотири зміни: DU/2026/1079 (чинна 09-10, опублікована 08-10),
   * DU/2026/846 (чинна 10-01, опублікована 06-25 — до звірки, але в силі
   * з сьогодні), DU/2026/1098 (2027-01-01, опублікована 08-18) і
   * DU/2026/1123 (2028-01-01, опублікована 08-25). Усі чотири — нові для
   * людини, що звіряла 18.07. 26 рішень TK — з років до 2026, їх не питаємо.
   */
  it('звірка від 2026-07-18 → потребує підтвердження, чотири зміни поіменно', async () => {
    const check = await checkAct({ rule: ruleAt('2026-07-18'), law: PIT, act: { meta: eli('DU/1991/350'), failure_reason: null }, amendment, today: TODAY });
    expect(check.state).toBe(STATES.NEEDS_CONFIRMATION);
    expect(check.amended.map((a) => a.id).sort()).toEqual(['DU/2026/1079', 'DU/2026/1098', 'DU/2026/1123', 'DU/2026/846']);
    expect(check.failure_reason).toContain('перечитати art. 3 ust. 2a');
    expect(check.fetched_from).toBe('https://api.sejm.gov.pl/eli/acts/DU/1991/350');
  });

  /**
   * Людина перезвірила 2026-10-01. Лишаються дві зміни з чинністю в 2027 і
   * 2028, але обидві опубліковані до звірки — людина їх бачила. Сигнал має
   * знятись, інакше правило висіло б «потребує підтвердження» до 2028 року.
   */
  it('повторна звірка 2026-10-01 знімає сигнал — відомі майбутні зміни не висять', async () => {
    const check = await checkAct({ rule: ruleAt('2026-10-01'), law: PIT, act: { meta: eli('DU/1991/350'), failure_reason: null }, amendment, today: TODAY });
    expect(check.state).toBe(STATES.MATCH);
  });

  it('конвенція PL-UA без змін → збігається; ключа змін у відповіді немає — це порожній список', async () => {
    const meta = eli('DU/1994/269');
    expect(meta.references['Akty zmieniające']).toBeUndefined();
    const check = await checkAct({ rule: ruleAt('2026-07-18'), law: act('umowaPlUa', 'art. 4 ust. 2'), act: { meta, failure_reason: null }, amendment, today: TODAY });
    expect(check.state).toBe(STATES.MATCH);
  });

  /** Мутація: у незмінний акт дописано зміну, опубліковану після звірки. */
  it('мутація: зміна після verified_at у відповіді → потребує підтвердження, не «збігається»', async () => {
    const meta = structuredClone(eli('DU/1994/269'));
    meta.references['Akty zmieniające'] = [{ id: 'DU/2026/1079', date: '2026-09-10' }];
    const check = await checkAct({ rule: ruleAt('2026-07-18'), law: act('umowaPlUa', 'art. 4 ust. 2'), act: { meta, failure_reason: null }, amendment, today: TODAY });
    expect(check.state).toBe(STATES.NEEDS_CONFIRMATION);
  });

  it('ELI не відповів → недоступне з причиною, не «збігається»', async () => {
    const check = await checkAct({ rule: ruleAt('2026-07-18'), law: PIT, act: { meta: null, failure_reason: 'запит не вдався: timeout' }, amendment, today: TODAY });
    expect(check.state).toBe(STATES.UNAVAILABLE);
    expect(check.failure_reason).toContain('timeout');
  });

  it('відповідь без references — інша форма, недоступне, а не «змін немає»', async () => {
    const check = await checkAct({ rule: ruleAt('2026-07-18'), law: PIT, act: { meta: { title: 'x' }, failure_reason: null }, amendment, today: TODAY });
    expect(check.state).toBe(STATES.UNAVAILABLE);
  });
});

describe('relevantAmendments: що робить звірку застарілою', () => {
  const V = '2026-07-18';
  const a = (effective, promulgation) => ({ id: 'DU/2026/1', kind: 'зміна', effective, promulgation });

  it.each([
    ['опублікована після звірки', a('2027-01-01', '2026-08-01'), true],
    ['опублікована до звірки, чинна з дня між звіркою і сьогодні', a('2026-09-01', '2026-06-01'), true],
    ['опублікована до звірки, чинна в майбутньому', a('2027-01-01', '2026-06-01'), false],
    ['чинна ще до звірки', a('2026-07-01', '2026-06-01'), false],
    ['дата публікації невідома — рахується', a('2027-01-01', null), true],
    ['виправлення без дати чинності, опубліковане після звірки', a(null, '2026-08-01'), true],
    ['виправлення без дати чинності, опубліковане до звірки', a(null, '2026-06-01'), false],
  ])('%s', (_, amendmentEntry, expected) => {
    expect(relevantAmendments([amendmentEntry], V, TODAY).length > 0).toBe(expected);
  });
});

describe('isCandidate: які записи взагалі питати', () => {
  it('рішення TK без дати з року до звірки не питаємо; того ж року — питаємо', () => {
    expect(isCandidate({ id: 'DU/2023/353', effective: null }, '2026-07-18')).toBe(false);
    expect(isCandidate({ id: 'DU/2026/12', effective: null }, '2026-07-18')).toBe(true);
    expect(isCandidate({ id: 'щось/інше', effective: null }, '2026-07-18')).toBe(true);
  });
});

describe('amendmentsOf', () => {
  it('зміни, виправлення й рішення TK — в одному списку з видом', () => {
    const list = amendmentsOf({ references: { 'Akty zmieniające': [{ id: 'A', date: '2026-01-01' }], Sprostowanie: [{ id: 'B' }], 'Orzeczenie TK': [{ id: 'C' }] } });
    expect(list).toEqual([
      { id: 'A', kind: 'зміна', effective: '2026-01-01' },
      { id: 'B', kind: 'виправлення тексту', effective: null },
      { id: 'C', kind: 'рішення TK', effective: null },
    ]);
  });
});

describe('edition: zakon.rada.gov.ua на справжніх сторінках 2026-10-01', () => {
  const esvRule = { rule_id: 'fop.esv_vz', params: {}, source_url: 'https://zakon.rada.gov.ua/laws/show/2464-17', verified_at: '2026-07-29' };

  it('дата поточної редакції читається з обох сторінок', () => {
    expect(currentEdition(rada('2755-17'))).toBe('2026-09-17');
    expect(currentEdition(rada('2464-17'))).toBe('2026-01-26');
  });

  it('ПКУ: редакція від 17.09.2026 пізніша за звірку 29.07 → потребує підтвердження', () => {
    const check = checkEdition({ rule: esvRule, law: edition('pku', 'п. 16-1 підрозд. 10 розд. XX'), text: rada('2755-17'), failure_reason: null });
    expect(check.state).toBe(STATES.NEEDS_CONFIRMATION);
    expect(check.edition).toBe('2026-09-17');
  });

  it('закон про ЄСВ: редакція від 26.01.2026 раніша за звірку → збігається', () => {
    const check = checkEdition({ rule: esvRule, law: edition('esv', 'ст. 8'), text: rada('2464-17'), failure_reason: null });
    expect(check.state).toBe(STATES.MATCH);
    // Дата редакції — не значення правила: у fetched_value її немає, число не порівнювалось.
    expect(check.edition).toBe('2026-01-26');
    expect(check.fetched_value).toBeNull();
    expect(check.compared).toBe(false);
  });

  it('мутація: дата редакції ЄСВ зсунута за звірку → потребує підтвердження', () => {
    const text = rada('2464-17').replace('Редакція від 26.01.2026', 'Редакція від 15.09.2026');
    const check = checkEdition({ rule: esvRule, law: edition('esv', 'ст. 8'), text, failure_reason: null });
    expect(check.state).toBe(STATES.NEEDS_CONFIRMATION);
  });

  it('маркера редакції немає → недоступне, а не «збігається»', () => {
    const text = rada('2464-17').replace('поточна редакція', 'інший текст');
    const check = checkEdition({ rule: esvRule, law: edition('esv', 'ст. 8'), text, failure_reason: null });
    expect(check.state).toBe(STATES.UNAVAILABLE);
  });

  it('сторінка не відповіла → недоступне з причиною', () => {
    const check = checkEdition({ rule: esvRule, law: edition('esv', 'ст. 8'), text: null, failure_reason: 'джерело відповіло 403' });
    expect(check.state).toBe(STATES.UNAVAILABLE);
    expect(check.failure_reason).toContain('403');
  });
});

describe('документ відбитком: Objaśnienia MF 29.04.2021, PDF знятий 2026-10-01', () => {
  const pdf = readFileSync(join(HERE, '__fixtures__', 'documents', 'objasnienia-rezydencja-2021.pdf'));
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const law = edition('objasnieniaRezydencja', 'с. 7–8');
  const rule = ruleAt('2026-07-18');

  it('посилання — документ, а не сторінка zakon.rada', () => {
    expect(isDocument(law)).toBe(true);
    expect(isDocument(edition('pku', 'ст. 293'))).toBe(false);
  });

  it('той самий файл → збігається, число не порівнювалось', () => {
    const check = checkDocument({ rule, law, param: 'x', sha256: sha(pdf), failure_reason: null });
    expect(check.state).toBe(STATES.MATCH);
    expect(check.compared).toBe(false);
  });

  /** Мутація: у файлі змінено один байт — документ уже інший. */
  it('мутація: один байт файла змінено → потребує підтвердження', () => {
    const changed = Buffer.from(pdf);
    changed[changed.length - 10] ^= 0xff;
    const check = checkDocument({ rule, law, param: 'x', sha256: sha(changed), failure_reason: null });
    expect(check.state).toBe(STATES.NEEDS_CONFIRMATION);
    expect(check.failure_reason).toContain('перечитати с. 7–8');
  });

  it('файл не віддався → недоступне з причиною', () => {
    const check = checkDocument({ rule, law, param: 'x', sha256: null, failure_reason: 'джерело відповіло 404' });
    expect(check.state).toBe(STATES.UNAVAILABLE);
  });
});

