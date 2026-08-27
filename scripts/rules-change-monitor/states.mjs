// Стани звірки — спільний контракт нарізки. Усі модулі
// (`allowlist`, `normalize`, `diff`, `state`, `report`) читають перелік звідси
// і ніде не пишуть рядок стану літералом: розходження двох таких літералів
// нічим не ловиться, а інваріант AC-03 стоїть саме на тому, що набір один.
//
// Сім значень — дослівно AC-03 (`docs/features/rules-change-monitor/PRD.md:99`).
// Контракт подій (`contracts/events.md:65`) називає їх «one of 7» і лишає
// точний перелік TBD — ось він, і його англійські ключі закріплені тут.

/** @typedef {'match'|'cosmetic'|'divergence'|'unavailable'|'out_of_scope'|'not_verified'|'needs_confirmation'} CheckState */

export const STATES = Object.freeze({
  /** Джерело віддало те саме число, що в матриці. */
  MATCH: "match",
  /** Різниця тільки у форматі: 4 806,00 проти 4806. Число те саме (AC-04). */
  COSMETIC: "cosmetic",
  /** Число після нормалізації інше — саме це йде людині на рішення (AC-05). */
  DIVERGENCE: "divergence",
  /** Джерело не відповіло або віддало нечитабельне. НЕ те саме, що «збігається». */
  UNAVAILABLE: "unavailable",
  /** Правило поза скоупом автозвірки: його джерело не скриптується (WAF). */
  OUT_OF_SCOPE: "out_of_scope",
  /** У матриці немає `verified_at` — звіряти нема з чим, спершу верифікація. */
  NOT_VERIFIED: "not_verified",
  /**
   * Цифру колись ветовано, і джерело пропонує її знову. Присвоюється в S-4:
   * потрібен реєстр veto, якого ця нарізка не будує. Оголошено тут, щоб
   * інваріант «рівно один стан із СЕМИ» не переписувався заднім числом.
   */
  NEEDS_CONFIRMATION: "needs_confirmation",
});

/** Усі сім значень у стабільному порядку. */
export const ALL_STATES = Object.freeze(Object.values(STATES));

/** Стани, які присвоює ця нарізка. `needs_confirmation` — S-4, не тут. */
export const STATES_IN_SCOPE = Object.freeze(ALL_STATES.filter((s) => s !== STATES.NEEDS_CONFIRMATION));

export function isState(value) {
  return ALL_STATES.includes(value);
}

/**
 * Стани, при яких звіт НЕ має права мовчати: вони означають, що цифру ніхто не
 * підтвердив. Використовується звітом, щоб «не вдалось перевірити» не осідало
 * в тому самому рядку, що «збігається».
 */
export const UNCONFIRMED_STATES = Object.freeze([
  STATES.UNAVAILABLE,
  STATES.OUT_OF_SCOPE,
  STATES.NOT_VERIFIED,
  STATES.NEEDS_CONFIRMATION,
]);

/**
 * Один запис звірки. JSDoc, а не TS: `scripts/` у цьому репо на .mjs, і
 * `app/lib/calc` навмисно не єдиний носій типів (карта шарів у CLAUDE.md).
 *
 * @typedef {object} RuleCheck
 * @property {string} rule_id            ід правила з rules.2026.json
 * @property {CheckState} state          рівно один стан із семи
 * @property {number|string|null} matrix_value   що зараз у матриці
 * @property {number|string|null} fetched_value  що віддало джерело (null, якщо не питали або не вийшло)
 * @property {number|null} diff_percent  розбіжність у відсотках; null, доки стан не divergence
 * @property {string|null} failure_reason  чому не вийшло; null на успіху
 * @property {string|null} fetched_from   сторінка, з якої реально взято `fetched_value`
 * @property {string|null} source_url    джерело, записане в матриці
 * @property {string|null} verified_at   дата останньої ручної звірки з матриці
 */
