// Джерела, з яких нарізка реально вміє дістати число.
//
// Реєстр навмисно вузький. «Джерело в allowlist» і «ми вміємо витягти з нього
// цифру» — різні твердження: сторінка може бути доступною і при цьому не мати
// стабільного місця, де лежить саме це значення. Правило без запису тут
// лишається поза автозвіркою з названою причиною, а не отримує тихий `match`.

import { STATES } from "./states.mjs";

/** Скільки чекаємо сторінку. Довше за це — цикл важливіший за одне джерело. */
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * Витяг значення зі сторінки. Кожен екстрактор дає СИРИЙ рядок як він стоїть у
 * тексті (`4 806,00 zł`), а не число: рішення про формат ухвалює `normalize`,
 * і саме різниця сирих рядків при однаковому числі дає стан `cosmetic`.
 *
 * @type {Record<string, { url: string, matrixValue: (params: object) => number|string|null, extract: (html: string) => string|null }>}
 */
export const EXTRACTORS = Object.freeze({
  "common.minimum_wage": {
    url: "https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki/skladki/wysokosc-skladek-na-ubezpieczenia-spoleczne",
    matrixValue: (params) => params?.monthly ?? null,
    // Мінімальна зарплата стоїть у тексті поряд зі словом-маркером. Беремо
    // перше число після нього, а не перше число на сторінці: сторінка повна
    // сум, і «перше зверху» змінюється від будь-якої правки верстки.
    extract: (html) => amountNear(html, /100\s*%\s*minimalnego\s+wynagrodze/i),
  },
});

/**
 * Наскільки близько до маркера ще вважаємо, що сума стосується саме його.
 * 160 символів — це приблизно одне речення на цих сторінках; ширше вікно вже
 * дотягується до сусідньої ставки, вужче не бачить формулювання
 * «kwota 4 806 zł (100% minimalnego wynagrodzenia)».
 */
const WINDOW = 160;

/**
 * Сума в польському форматі. Групи тисяч описані явно (`\d{1,3}` через один
 * роздільник), а не як «цифри й пробіли підряд»: широкий клас перетинав межу
 * між двома сусідніми числами таблиці — `<td>2026</td><td>4 806 zł</td>` після
 * зняття тегів давав один матч і число 20 264 806.
 *
 * Валютна позначка ОБОВʼЯЗКОВА, і це не косметика:
 * без неї збігається будь-яка цифра сторінки, включно з номером рівня меню
 * (`nav__li--lvl3-link`). Саме так перша версія віддала «120» замість ставки.
 */
const AMBIGUITY_FACTOR = 2;

const AMOUNT = /\d{1,3}(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d{1,2})?\s*(?:zł|PLN)/g;

/**
 * Сума, найближча до маркера. Три речі, кожна з живого прогону 2026-08-26, а
 * не з обережності:
 *   1. перебираємо ВСІ входження маркера — на zus.pl він спершу трапляється в
 *      навігації, де числа немає взагалі;
 *   2. дивимось В ОБИДВА боки — на цій сторінці ставка стоїть ПЕРЕД маркером
 *      («kwota 4 806 zł (100% minimalnego wynagrodzenia)»), тож «перше число
 *      після» структурно не працює;
 *   3. беремо найближчу до маркера суму, бо в тому ж абзаці стоять ще дві
 *      інші ставки.
 * Нічого не знайшли — null. Далі це стане станом `unavailable`, тобто чесним
 * «не перевірили», а не тихим «збігається».
 */
export function amountNear(html, marker) {
  if (typeof html !== "string") return null;
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  const flags = marker.flags.includes("g") ? marker.flags : `${marker.flags}g`;
  const scan = new RegExp(marker.source, flags);

  for (let hit = scan.exec(text); hit !== null; hit = scan.exec(text)) {
    const from = Math.max(0, hit.index - WINDOW);
    const slice = text.slice(from, hit.index + WINDOW);
    const anchor = hit.index - from;

    // Відстань міряється до НАЙБЛИЖЧОГО краю маркера: інакше сума праворуч
    // штрафувалась би довжиною самого маркера, і «рівновіддалені» ліворуч і
    // праворуч переставали б бути рівними.
    const markerEnd = anchor + hit[0].length;
    const candidates = [];
    for (const found of slice.matchAll(AMOUNT)) {
      const end = found.index + found[0].length;
      const distance = found.index >= markerEnd ? found.index - markerEnd : anchor - end;
      candidates.push({ raw: found[0].trim(), distance });
    }
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => a.distance - b.distance);

    // Дві суми майже рівновіддалені від маркера — прив'язка неоднозначна, і
    // вибір «трохи ближчої» був би вгадуванням. Живий прогін 2026-08-26 саме
    // так дав 1 788,29 замість 4 806 і показав це розбіжністю в -62,79%,
    // тобто хибнопозитивом, якого NFR PRD дозволяє не більше одного за цикл.
    // Порожньо тут чесніше: далі це стане станом «не вдалось перевірити».
    if (candidates.length > 1 && candidates[1].distance < candidates[0].distance * AMBIGUITY_FACTOR) {
      return null;
    }
    return candidates[0].raw;
  }
  return null;
}

/**
 * Фетч однієї сторінки. Мережеву помилку НЕ ковтає і не перетворює на порожній
 * рядок: порожнє від недоступного джерела читалось би далі як «нема змін».
 *
 * @returns {Promise<{ html: string|null, failure_reason: string|null }>}
 */
export async function fetchSource(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      return { html: null, failure_reason: `джерело відповіло ${response.status}` };
    }
    return { html: await response.text(), failure_reason: null };
  } catch (error) {
    return { html: null, failure_reason: `запит не вдався: ${error?.message ?? error}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Правило, для якого екстрактора немає. Це `out_of_scope`, а не `unavailable`:
 * джерело не падало, ми просто не звіряємо це правило автоматично.
 */
export function noExtractorCheck(rule) {
  return {
    rule_id: rule.rule_id,
    state: STATES.OUT_OF_SCOPE,
    matrix_value: null,
    fetched_value: null,
    diff_percent: null,
    failure_reason: "джерело в allowlist, але патерну витягу для цього правила ще немає",
    fetched_from: null,
    source_url: rule.source_url ?? null,
    verified_at: rule.verified_at ?? null,
  };
}
