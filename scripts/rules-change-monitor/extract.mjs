// Інструменти витягу значення з тексту сторінки. Реєстр сторінок (`pages.mjs`)
// описує, ДЕ на сторінці лежить кожне число; цей модуль — ЯК його звідти взяти.
//
// Кожен витяг повертає СИРИЙ рядок як він стоїть у тексті (`1441,80 zł`, `9,76%`),
// а не число: формат розбирає `normalize.mjs`, і різниця сирих рядків при тому
// самому числі дає стан `cosmetic`, а не `match`.

/** Текст сторінки без тегів, зі знятими сутностями і стиснутими пробілами. */
export function pageText(html) {
  if (typeof html !== "string") return "";
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " "),
  )
    // Нуль-ширинні пробіли zus.pl вставляє посеред сум (`1 495,04 zł`): без
    // цього валюта відривається від числа, і сума перестає бути сумою.
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[\s\u00a0\u202f]+/g, " ")
    .trim();
}

const NAMED_ENTITIES = Object.freeze({
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  oacute: "ó", Oacute: "Ó", ndash: "–", mdash: "—", bdquo: "„", rdquo: "”",
});

/**
 * podatki.gov.pl кодує польські літери числовими сутностями (`wed&#x142;ug`),
 * zus.pl — ні. Без декодування маркер `według` не знайшовся б на одній зі
 * сторінок, і правило мовчки стало б `unavailable`.
 */
function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name] ?? whole);
}

/**
 * Сума в злотих. Дві форми запису, обидві з живих сторінок: з пробілом тисяч
 * (`9 228,64 zł`, zus.pl) і без нього (`1441,80 zł` у тій самій таблиці).
 *
 * Ліва межа `(?<![\d,.])` — не косметика. Без неї `1441,80 zł` матчився з
 * середини як `441,80 zł`: регулярка не змогла вкласти чотири цифри поспіль у
 * групу тисяч і почала з другої цифри. Тисячі зникали мовчки.
 *
 * Валюта обов'язкова: без неї збігається будь-яка цифра сторінки, включно з
 * номером рівня меню (перша версія так віддала «120» замість ставки).
 */
export const AMOUNT = /(?<![\d,.])(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{1,2})?\s?(?:zł|PLN)/g;

/** Відсоток: `9,76%`, `19 %`, `2,45 proc.` (biznes.gov.pl пише і так). */
export const PERCENT = /(?<![\d,.])\d{1,3}(?:[.,]\d{1,2})?\s?(?:%|proc\.)/g;

/** Ціле число з групами тисяч, без валюти: `120 000`, `183`, `60`. */
export const INTEGER = /(?<![\d,.])(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?![\d,.]\d)/g;

const MONTHS = Object.freeze({
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, października: 10, listopada: 11, grudnia: 12,
});

/** Польська дата словами: `8 lipca 2026`, `1 czerwca 2025 r.` */
export const PL_DATE = new RegExp(`(?<!\\d)\\d{1,2} (?:${Object.keys(MONTHS).join("|")}) \\d{4}`, "gi");

/** `8 lipca 2026` → `2026-07-08`; не дата — null. */
export function isoFromPolishDate(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().toLowerCase().match(/^(\d{1,2}) (\p{L}+) (\d{4})$/u);
  const month = m ? MONTHS[m[2]] : undefined;
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Значення за ланцюжком маркерів. `after` — регулярки, які шукаються по черзі,
 * кожна від кінця попередньої: так задається місце в таблиці («рядок таблиці
 * zdrowotnej → клітинка суми»), а не «перше число на сторінці». Значення
 * береться `nth`-им (від нуля) у вікні `within` символів після останнього маркера.
 *
 * Вікно — головний запобіжник. Сторінка без потрібного рядка інакше віддала б
 * число з наступного розділу, і воно пішло б у звірку як значення джерела.
 * Не знайшли — null: далі це `unavailable` з причиною, а не тихий `match`.
 *
 * @param {string} text  результат `pageText`
 * @param {{ after?: RegExp[], before?: RegExp|null, value: RegExp, nth?: number, within?: number }} spec
 * @returns {string|null}
 */
export function pick(text, { after = [], before = null, value, nth = 0, within = 120 }) {
  if (typeof text !== "string" || text === "") return null;
  let from = 0;
  for (const marker of after) {
    const hit = findFrom(text, marker, from);
    if (!hit) return null;
    from = hit.index + hit[0].length;
  }
  const all = (window) => [...window.matchAll(globalOf(value))].map((m) => m[0].trim());

  // `before`: значення стоїть ПЕРЕД маркером («19% - od dochodów z…»), і береться
  // найближче до нього. Вікно тоді відкладається назад від початку маркера.
  if (before) {
    const hit = findFrom(text, before, from);
    if (!hit) return null;
    const found = all(text.slice(Math.max(from, hit.index - within), hit.index));
    return found[found.length - 1 - nth] ?? null;
  }
  return all(text.slice(from, from + within))[nth] ?? null;
}

const globalOf = (re) => new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);

function findFrom(text, marker, from) {
  const scan = globalOf(marker);
  scan.lastIndex = from;
  return scan.exec(text);
}
