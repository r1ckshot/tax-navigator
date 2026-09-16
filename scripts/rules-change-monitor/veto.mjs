// Реєстр veto і третя гілка класифікації (S-4, AC-10).
//
// Пастка, від якої це стоїть: ветована цифра не зникає з мережі. Ставки
// реформи zdrowotnej 2025 досі гуляють по сайтах (`docs/EVIDENCE.md`,
// «Нестабільності» п.1), і сторінка, що їх повторює, дала б звичайну
// `divergence` — тобто виглядала б як свіжа зміна закону, яку варто прийняти.
//
// Реєстр — JSON у git, не в `data/`: `data/` ігнорується як робочі дані
// прогонів, а цей список поповнюється руками при кожному інциденті (PRD §8) і
// мусить пережити будь-який клон. Той самий вибір форми, що ADR-0002.

import { readFileSync, existsSync } from "node:fs";

import { normalizeNumber } from "./normalize.mjs";
import { STATES } from "./states.mjs";

/**
 * Стани, які veto має право перекрити. Лише ті, де джерело справді віддало
 * число: `unavailable` і стани без фетчу значення не мають, порівнювати нема що.
 * `match` теж тут: матриця, що сама тримає ветовану цифру, — не «усе гаразд».
 */
const OVERRIDABLE = Object.freeze([STATES.MATCH, STATES.COSMETIC, STATES.DIVERGENCE]);

const REQUIRED_FIELDS = Object.freeze(["rule_id", "vetoed_value", "reason", "source", "created_at"]);

/**
 * @typedef {object} VetoEntry
 * @property {string} rule_id       ід правила з rules.2026.json
 * @property {string} vetoed_value  скасована цифра, як її записала людина
 * @property {string} reason        чому ветовано, коротко
 * @property {string} source        де це задокументовано: URL або шлях у репо
 * @property {string} created_at    коли запис додано, YYYY-MM-DD
 */

/**
 * Перевіряє форму реєстру. Кидає, а не пропускає биті записи: запис без числа
 * тихо не спрацював би ніколи, і реєстр виглядав би як захист, яким не є.
 *
 * @param {unknown} parsed
 * @param {string} label  звідки дані, для тексту помилки
 * @returns {VetoEntry[]}
 */
export function validateRegistry(parsed, label = "реєстр veto") {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    throw new Error(`${label} має неочікувану форму — очікувався об'єкт з полем "entries"`);
  }
  parsed.entries.forEach((entry, i) => {
    const missing = REQUIRED_FIELDS.filter((f) => typeof entry?.[f] !== "string" || entry[f].trim() === "");
    if (missing.length > 0) {
      throw new Error(`${label}, запис ${i}: порожні поля ${missing.join(", ")}`);
    }
    if (normalizeNumber(entry.vetoed_value) === null) {
      throw new Error(`${label}, запис ${i} (${entry.rule_id}): vetoed_value не число: ${JSON.stringify(entry.vetoed_value)}`);
    }
  });
  return parsed.entries;
}

/**
 * Читає реєстр. Відсутній файл — помилка, а не порожній список: на відміну від
 * історії циклів, реєстр живе в git, і його зникнення означає поломку, а не
 * «veto ще не було». Порожній список мовчки вимкнув би гілку AC-10.
 *
 * @param {string} path
 * @returns {VetoEntry[]}
 */
export function readVetoRegistry(path) {
  if (!existsSync(path)) {
    throw new Error(`реєстр veto не знайдено: ${path}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`реєстр veto (${path}) не валідний JSON: ${err.message}`);
  }
  return validateRegistry(parsed, `реєстр veto (${path})`);
}

/**
 * Третя гілка класифікації: значення джерела збігається з ветованою цифрою
 * того самого правила → `needs_confirmation`. Функція без пам'яті між циклами,
 * тож veto діє в КОЖНОМУ циклі, доки запис лежить у реєстрі (AC-derived S-4).
 *
 * Повертає новий запис; вхідний не мутується.
 *
 * @param {import('./states.mjs').RuleCheck} check
 * @param {VetoEntry[]} entries
 * @returns {import('./states.mjs').RuleCheck}
 */
export function applyVeto(check, entries) {
  if (!OVERRIDABLE.includes(check.state) || check.fetched_value === null) {
    return check;
  }
  const hit = entries.find(
    (e) => e.rule_id === check.rule_id && normalizeNumber(e.vetoed_value) === check.fetched_value,
  );
  if (!hit) {
    return check;
  }
  return {
    ...check,
    state: STATES.NEEDS_CONFIRMATION,
    failure_reason: `джерело повертає ветовану цифру ${hit.vetoed_value}: ${hit.reason}`,
    veto: { vetoed_value: hit.vetoed_value, reason: hit.reason, source: hit.source },
  };
}
