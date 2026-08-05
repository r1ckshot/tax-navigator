#!/usr/bin/env node
/**
 * Тягне складку zdrowotną з ДЕРЖАВНОГО калькулятора ZUS і складає фікстуру, з
 * якою потім звіряються тести — офлайн, без мережі в `npm test`.
 *
 * Чому саме так, а не «Mike клікає в браузері»: калькулятор виявився звичайним
 * Liferay-портлетом. Форма приймає POST, у відповідь віддає HTML із порахованим
 * числом, і підтримує `periodYear=2026`. Тобто половина ворота G2 (складки)
 * відтворюється автоматично; друга половина (PIT) держкалькулятора не має
 * взагалі — виводиться вручну з норми (див. docs/STATE.md, BRIEF G2).
 *
 * Запуск:  node scripts/fetch-zus-benchmark.mjs
 * Результат: app/lib/calc/__tests__/zus-state-benchmark.json
 *
 * Скрипт НЕ звіряє нічого сам і нічого не «підганяє» — він лише записує, що
 * відповіла держава і коли. Розбіжність ловлять тести.
 */

import { writeFile } from 'node:fs/promises';

const PAGE = 'https://www.zus.pl/firmy/przedsiebiorco-przeczytaj-wazne/kalkulator-skladki-zdrowotnej';
const OUT = new URL('../app/lib/calc/__tests__/zus-state-benchmark.json', import.meta.url);

/**
 * Місяць свідомо НЕ січень: мінімальна база для skali й liniowego повернулась до
 * 100% мінімалки лише з лютого 2026 (за січень мінімум інший — 314.96).
 */
const PERIOD = { month: '7', year: '2026' };

/**
 * Кожен кейс б'є в конкретний параметр `rules.2026.json`. Межі ярусів беруться
 * парами (рівно на порозі / одразу за ним) — саме там помилка «>» замість «>=»
 * і живе.
 */
const CASES = [
  { id: 'ryczalt.tier1.mid', form: 'lump', annualRevenue: 50000, note: 'нижній ярус: прихід ≤ 60k' },
  { id: 'ryczalt.tier1.edge', form: 'lump', annualRevenue: 60000, note: 'рівно на порозі 60k' },
  { id: 'ryczalt.tier2.low', form: 'lump', annualRevenue: 60000.01, note: 'на грош за порогом 60k' },
  { id: 'ryczalt.tier2.mid', form: 'lump', annualRevenue: 180000, note: 'середній ярус: 60k–300k' },
  { id: 'ryczalt.tier2.edge', form: 'lump', annualRevenue: 300000, note: 'рівно на порозі 300k' },
  { id: 'ryczalt.tier3.low', form: 'lump', annualRevenue: 300000.01, note: 'на грош за порогом 300k' },
  { id: 'ryczalt.tier3.mid', form: 'lump', annualRevenue: 400000, note: 'верхній ярус: > 300k' },
  { id: 'liniowy.rate', form: 'flat', monthlyIncome: 15000, note: '4.9% від доходу' },
  { id: 'liniowy.min', form: 'flat', monthlyIncome: 5000, note: '4.9% нижче мінімуму → мінімум' },
  { id: 'skala.rate', form: 'scale', monthlyIncome: 10000, note: '9% від доходу' },
  { id: 'skala.min', form: 'scale', monthlyIncome: 1000, note: '9% нижче мінімуму → мінімум' },
];

const UA = 'Mozilla/5.0 (compatible; tax-navigator-benchmark/1.0)';

function money(value) {
  return value.toFixed(2).replace('.', ',');
}

/** Портлет тримає CSRF-подібний токен і calcModel просто в `action` форми. */
async function formAction() {
  const res = await fetch(PAGE, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`сторінка калькулятора віддала ${res.status}`);
  const html = await res.text();
  const match = html.match(/<form id="zus-polish-deal-calculator"[^>]*action="([^"]+)"/);
  if (!match) throw new Error('форму калькулятора не знайдено — розмітка ZUS змінилась');
  return match[1].replaceAll('&amp;', '&');
}

function fieldsFor(testCase) {
  // Портлет очікує ВСІ форми оподаткування в тілі: незазначені приходять лише
  // хованим `_прапорець=on`, зазначена — ще й своїм значенням.
  const fields = {
    periodMonth: PERIOD.month,
    periodYear: PERIOD.year,
    startMonth: '0',
    startYear: '2022',
    _formScale: 'on',
    _formScaleFirstMonth: 'on',
    _formFlat: 'on',
    _formFlatFirstMonth: 'on',
    _formLump: 'on',
    _formLumpLastYear: 'on',
    _formCard: 'on',
    _formNone: 'on',
  };
  if (testCase.form === 'lump') {
    fields.formLump = 'true';
    fields.formLumpSumCurrent = money(testCase.annualRevenue);
  } else if (testCase.form === 'flat') {
    fields.formFlat = 'true';
    fields.formFlatIncome = money(testCase.monthlyIncome);
  } else {
    fields.formScale = 'true';
    fields.formScaleIncome = money(testCase.monthlyIncome);
  }
  return fields;
}

/** Держава відповідає HTML-сторінкою; число лежить у підсумковому рядку. */
function parseContribution(html, testCase) {
  const match = html.match(/Składka na ubezpieczenie zdrowotne - suma[\s\S]{0,600}?([\d\s ]+,\d\d)\s*zł/);
  if (!match) throw new Error(`кейс ${testCase.id}: підсумок не розпізнано`);
  const value = Number(match[1].replace(/[\s ]/g, '').replace(',', '.'));
  if (!Number.isFinite(value)) throw new Error(`кейс ${testCase.id}: «${match[1]}» не число`);
  return value;
}

async function ask(action, testCase) {
  const res = await fetch(action, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fieldsFor(testCase)).toString(),
  });
  if (!res.ok) throw new Error(`кейс ${testCase.id}: калькулятор віддав ${res.status}`);
  return parseContribution(await res.text(), testCase);
}

async function main() {
  const action = await formAction();
  const cases = [];
  for (const testCase of CASES) {
    const monthlyContribution = await ask(action, testCase);
    console.log(`${testCase.id.padEnd(22)} -> ${monthlyContribution.toFixed(2)} zł`);
    cases.push({ ...testCase, monthlyContribution });
  }

  const fixture = {
    _comment:
      'Відповіді ДЕРЖАВНОГО калькулятора ZUS. Не редагувати руками: перезбирається ' +
      '`node scripts/fetch-zus-benchmark.mjs`. Розбіжність із движком — привід ' +
      'знайти причину, а не правити цей файл.',
    source_url: PAGE,
    fetched_at: new Date().toISOString().slice(0, 10),
    period: PERIOD,
    cases,
  };
  await writeFile(OUT, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  console.log(`\n${cases.length} кейсів записано у ${OUT.pathname}`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
