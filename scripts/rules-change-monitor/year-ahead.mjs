// Сигнал «правила наступного року вже існують» — тригер теми П.1 ROADMAP.
//
// Два джерела, обидва без моделі:
//   1. Щорічні оголошення, з яких матриця бере числа, — шукаємо в ELI оголошення
//      для року, наступного за `tax_year` матриці. Знайшлось — нові числа вже
//      опубліковані, і матриця 2026 від 01.01 показуватиме минулорічні.
//   2. Зміни актів, що набирають чинності з 1 січня наступного року або пізніше, —
//      їх уже знайшов цикл (`laws.mjs`, поле `amended`), тут лише відбір.
//
// Перелік оголошень — ті самі документи, на які спирається EVIDENCE (мінімалка,
// обвіщення про 30-krotność, обвіщення GUS за IV квартал). Рік, до якого
// оголошення застосовується, береться з назви: дата публікації його не каже
// (оголошення про 2027 виходить у 2026).

import { ELI_API } from "./laws.mjs";
import { screenSource } from "./screen.mjs";
import { fetchSource } from "./sources.mjs";

/**
 * `forYear(title)` — рік, до якого застосовуються числа оголошення, або null,
 * якщо це інше оголошення з тим самим словом у назві (GUS публікує зарплату й за
 * інші квартали, і ті нас не цікавлять).
 */
export const ANNOUNCEMENTS = Object.freeze([
  {
    id: "minimum_wage",
    label: "мінімальна зарплата (rozporządzenie Rady Ministrów)",
    rules: ["common.minimum_wage", "zlecenie.zbieg_z_etatem", "nierejestrowana.limit"],
    publisher: "DU",
    title: "minimalnego wynagrodzenia za pracę",
    forYear: (title) => Number(title.match(/minimalnej stawki godzinowej w (\d{4}) r\./)?.[1]) || null,
  },
  {
    id: "contribution_cap",
    label: "30-krotność і прогнозована середня (obwieszczenie MRPiPS)",
    rules: ["common.projected_average_wage", "uop.annual_contribution_cap", "jdg.zus.stages"],
    publisher: "MP",
    title: "ograniczenia rocznej podstawy wymiaru",
    forYear: (title) => Number(title.match(/emerytalne i rentowe w roku (\d{4})/)?.[1]) || null,
  },
  {
    id: "zdrowotna_base",
    label: "середня зарплата за IV квартал — база zdrowotnej ryczałtu (obwieszczenie GUS)",
    rules: ["jdg.zdrowotna.ryczalt"],
    publisher: "MP",
    title: "przeciętnego miesięcznego wynagrodzenia w sektorze przedsiębiorstw",
    // Обвіщення за IV квартал року N дає базу на рік N+1 (EVIDENCE: «w czwartym
    // kwartale 2025 r.» → zdrowotna 2026).
    forYear: (title) => {
      const q4 = Number(title.match(/w czwartym kwartale (\d{4}) r\./)?.[1]);
      return q4 ? q4 + 1 : null;
    },
  },
]);

export function searchUrl({ publisher, title }) {
  return `${ELI_API}/search?publisher=${publisher}&title=${encodeURIComponent(title)}&limit=10`;
}

/**
 * Оголошення для років, пізніших за `taxYear`. Пошук, що не вдався, — не тиша, а
 * причина в `unavailable`: «нічого не знайдено» і «не змогли спитати» людина
 * має розрізняти.
 */
export async function findYearAhead({ taxYear, fetchImpl, announcements = ANNOUNCEMENTS }) {
  const found = [];
  const unavailable = [];
  for (const a of announcements) {
    const { html, failure_reason } = await fetchSource(searchUrl(a), { fetchImpl });
    // Назви з ELI їдуть в issue, тож проходять ту саму перевірку, що й решта входу циклу.
    const screened = failure_reason ? null : screenSource(html);
    let items = null;
    if (screened?.blocked) {
      unavailable.push({ id: a.id, label: a.label, failure_reason: screened.failure_reason });
      continue;
    }
    if (screened?.html) {
      try {
        items = JSON.parse(screened.html).items;
      } catch {
        items = null;
      }
    }
    if (!Array.isArray(items)) {
      unavailable.push({ id: a.id, label: a.label, failure_reason: failure_reason ?? "ELI віддав не JSON" });
      continue;
    }
    for (const item of items) {
      const year = a.forYear(String(item.title ?? ""));
      if (year !== null && year > taxYear) {
        found.push({ id: a.id, label: a.label, rules: a.rules, eli: item.ELI, year, promulgation: item.promulgation ?? null, title: item.title });
      }
    }
  }
  return { found, unavailable };
}

/**
 * Зміни актів із циклу, чинні з 1 січня року після `taxYear` або пізніше. Одна
 * зміна — один запис, хоч би скільки правил на неї вказувало.
 */
export function futureAmendments(cycle, taxYear) {
  const from = `${taxYear + 1}-01-01`;
  const byId = new Map();
  const visit = (check) => {
    for (const a of check.amended ?? []) {
      if (typeof a.effective !== "string" || a.effective < from) continue;
      const entry = byId.get(a.id) ?? { id: a.id, title: a.title ?? null, effective: a.effective, rules: [] };
      if (!entry.rules.includes(check.rule_id)) entry.rules.push(check.rule_id);
      byId.set(a.id, entry);
    }
    for (const f of check.fields ?? []) visit(f);
  };
  for (const check of cycle.checks) visit(check);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
