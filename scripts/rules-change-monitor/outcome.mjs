// Що робити з результатом циклу. Цикл каже стан кожного правила; тут — яка з
// трьох реакцій (sad.md §розклад) йому належить:
//
//   reverify    — збіг із першоджерелом: бот-PR піднімає `verified_at`;
//   attention   — розбіжність, змінений закон, ветована цифра: issue людині;
//   unavailable — джерело не відповіло: повтор, після трьох днів — issue.
//
// Модуль чистий: ні мережі, ні git, ні gh. Workflow лише виконує вирішене тут,
// тому правило «кому можна нову дату» живе в коді з тестами, а не в YAML.

import { createHash } from "node:crypto";

import { METHODS } from "./methods.mjs";
import { STATES } from "./states.mjs";

/** Скільки днів поспіль джерело може мовчати, перш ніж іти до людини (сесія 04). */
export const RETRY_DAYS = 3;

/**
 * Чи має правило право на нову `verified_at` (DECISIONS 2026-10-01, сесії 02 і 03).
 *
 * `cosmetic` — те саме число в іншому форматі (AC-04), тож теж збіг. Заборонено:
 * будь-який `manual`-лист (дата підтверджувала б неперевірене), відхилений вхід і
 * будь-яке поле не в стані збігу — агрегат бере найгірше, але перевіряємо й поля,
 * щоб правило не залежало від порядку SEVERITY.
 */
export function canReverify(check) {
  const ok = [STATES.MATCH, STATES.COSMETIC];
  if (!ok.includes(check.state)) return false;
  if (check.blocked === true) return false;
  // Легкий прогін бачив лише закони: «збігається» там не каже нічого про числа.
  if (check.laws_only === true) return false;
  if ((check.manual ?? []).length > 0) return false;
  if ((check.fields ?? []).some((f) => !ok.includes(f.state) || f.method === METHODS.MANUAL)) return false;
  return true;
}

const ATTENTION = [STATES.DIVERGENCE, STATES.NEEDS_CONFIRMATION, STATES.OUT_OF_SCOPE, STATES.NOT_VERIFIED];

/**
 * Розкладка циклу. Кожне правило — рівно в одному кошику; `blocked` іде людині
 * одразу, без повторів: відхилений вхід — це не погода (cycle.mjs, статус).
 */
export function classifyOutcome(cycle) {
  const reverify = [];
  const attention = [];
  const unavailable = [];
  for (const check of cycle.checks) {
    if (canReverify(check)) reverify.push(check.rule_id);
    else if (check.blocked === true || ATTENTION.includes(check.state)) attention.push(check);
    else if (check.state === STATES.UNAVAILABLE) unavailable.push(check);
    // match/cosmetic без права на дату (manual-лист) — теж людині: дату їй не дали.
    else attention.push(check);
  }
  return { reverify, attention, unavailable };
}

/**
 * Відбиток того, що людина вже бачила. Однаковий набір знахідок — той самий
 * issue, і повторний прогін не будить людину знову. Входить лише суть: правило,
 * стан, лист, значення джерела й ідентифікатори змін акта — не час прогону.
 */
export function fingerprint(items) {
  const lines = items
    .map((c) => {
      const amended = [...(c.amended ?? []), ...(c.fields ?? []).flatMap((f) => f.amended ?? [])].map((a) => a.id);
      const fields = (c.fields ?? [])
        .filter((f) => f.state !== STATES.MATCH)
        .map((f) => `${f.param}=${f.state}:${JSON.stringify(f.fetched_value ?? null)}`);
      return [c.rule_id ?? c.id, c.state ?? "", JSON.stringify(c.fetched_value ?? null), ...[...new Set(amended)].sort(), ...fields.sort()].join("|");
    })
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

/**
 * Лічильник «днів поспіль недоступне». `previous` — стан минулого прогону
 * (`{ [rule_id]: { since, days, lastDay } }`), `today` — `YYYY-MM-DD`. День
 * рахується раз: два прогони за день не скорочують очікування. Правило, що
 * відповіло, з лічильника зникає.
 *
 * @returns {{ streaks: Record<string, {since: string, days: number, lastDay: string}>, overdue: string[] }}
 */
export function updateStreaks(previous, unavailableIds, today) {
  const streaks = {};
  for (const id of unavailableIds) {
    const prev = previous?.[id];
    if (!prev) streaks[id] = { since: today, days: 1, lastDay: today };
    else if (prev.lastDay === today) streaks[id] = prev;
    else streaks[id] = { since: prev.since, days: prev.days + 1, lastDay: today };
  }
  const overdue = Object.entries(streaks)
    .filter(([, s]) => s.days >= RETRY_DAYS)
    .map(([id]) => id)
    .sort();
  return { streaks, overdue };
}
