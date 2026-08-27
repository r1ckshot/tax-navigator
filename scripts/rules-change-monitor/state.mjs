// Сховище історії циклів звірки (ADR-0002: JSON-файл, не SQL — фіча
// worker-скрипт поза межею node/react, окрема інфраструктура не виправдана).
//
// Ідемпотентність тримається тут, не в диспетчері циклу (`events.md` §Idempotency):
// дедуп-ключ циклу — `month`, повторний запуск того самого місяця замінює
// запис, а не додає другий.

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';

/**
 * Читає історію циклів з JSON-файлу.
 *
 * Відсутній файл — легітимний початковий стан («звірок ще не було»), тож
 * повертає порожню історію мовчки. Файл, що існує, але не парситься — інший
 * випадок: мовчазний порожній стан тут замаскував би пошкоджені дані під
 * «нічого ще не робилось», і людина вирішила б, що звірку просто не
 * запускали. Тому саме тут — падіння з людською причиною, а не дефолт.
 *
 * @param {string} path
 * @returns {{ cycles: Array<object> }}
 */
export function readHistory(path) {
  if (!existsSync(path)) {
    return { cycles: [] };
  }

  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`не вдалось прочитати історію циклів (${path}): ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`історія циклів (${path}) пошкоджена — не валідний JSON: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.cycles)) {
    throw new Error(`історія циклів (${path}) має неочікувану форму — очікувався об'єкт з полем "cycles"`);
  }

  return parsed;
}

/**
 * Додає (або заміщує) цикл в історії. Повертає НОВИЙ обʼєкт — аргумент
 * `history` не мутується, щоб виклик міг лишити собі попередній знімок для
 * порівняння.
 *
 * `month` унікальний: повторний запуск за той самий місяць заміщає запис
 * замість того, щоб додати другий (idempotency — `events.md` §Idempotency).
 *
 * @param {{ cycles: Array<object> }} history
 * @param {object} cycle
 * @returns {{ cycles: Array<object> }}
 */
export function appendCycle(history, cycle) {
  const withoutSameMonth = history.cycles.filter((c) => c.month !== cycle.month);
  return { ...history, cycles: [...withoutSameMonth, cycle] };
}

/**
 * Атомарний запис: спершу у файл поруч (`.tmp`), тоді `renameSync`.
 * `renameSync` на тій самій ФС — атомарна операція, тож обірваний запис
 * (crash, вимкнення) лишає або старий валідний файл, або новий валідний —
 * ніколи биту половину.
 *
 * @param {string} path
 * @param {{ cycles: Array<object> }} history
 */
export function writeHistory(path, history) {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(history, null, 2), 'utf8');
  renameSync(tmpPath, path);
}

/**
 * Останній цикл за `month` (лексикографічне порівняння коректне для
 * `YYYY-MM`), або null, якщо історія порожня.
 *
 * @param {{ cycles: Array<object> }} history
 * @returns {object|null}
 */
export function latestCycle(history) {
  if (history.cycles.length === 0) {
    return null;
  }
  return history.cycles.reduce((latest, c) => (c.month > latest.month ? c : latest));
}
