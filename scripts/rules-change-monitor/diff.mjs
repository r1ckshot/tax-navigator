// Звірка одного правила: матрична цифра проти сирого значення з джерела.
// Повертає рівно один `RuleCheck` (форма — `states.mjs`), стан — рівно один
// із `STATES_IN_SCOPE` (сьомий, `needs_confirmation`, присвоює лише S-4).

import { STATES } from "./states.mjs";
import { normalizeNumber, sameAfterNormalize } from "./normalize.mjs";

/**
 * @param {object} input
 * @param {string} input.rule_id
 * @param {number|string|null} input.matrix_value
 * @param {string|number|null} [input.fetched_raw]
 * @param {string|null} [input.source_url]
 * @param {string|null} [input.verified_at]
 * @param {string|null} [input.failure_reason]
 * @returns {import('./states.mjs').RuleCheck}
 */
export function compareValues({
  rule_id,
  matrix_value,
  fetched_raw = null,
  fetched_from = null,
  source_url = null,
  verified_at = null,
  failure_reason = null,
}) {
  const fetchedIsEmpty =
    fetched_raw === null || fetched_raw === undefined || fetched_raw === "";

  if (fetchedIsEmpty || failure_reason) {
    return {
      rule_id,
      state: STATES.UNAVAILABLE,
      matrix_value,
      fetched_value: null,
      diff_percent: null,
      failure_reason: failure_reason ?? "fetched_raw порожній",
      fetched_from,
      source_url,
      verified_at,
    };
  }

  const fetchedNumber = normalizeNumber(fetched_raw);

  if (fetchedNumber === null) {
    // Джерело щось повернуло, але це сміття зі сторінки (не число) — невідоме
    // значення не є розбіжністю, тож стан лишається "не вдалось перевірити",
    // а не "число інше".
    return {
      rule_id,
      state: STATES.UNAVAILABLE,
      matrix_value,
      fetched_value: null,
      diff_percent: null,
      failure_reason: `fetched_raw не нормалізується: ${JSON.stringify(fetched_raw)}`,
      fetched_from,
      source_url,
      verified_at,
    };
  }

  if (sameAfterNormalize(matrix_value, fetched_raw)) {
    const rawIdentical = String(matrix_value) === String(fetched_raw);
    return {
      rule_id,
      state: rawIdentical ? STATES.MATCH : STATES.COSMETIC,
      matrix_value,
      fetched_value: fetchedNumber,
      diff_percent: rawIdentical ? null : 0,
      failure_reason: null,
      fetched_from,
      source_url,
      verified_at,
    };
  }

  const matrixNumber = normalizeNumber(matrix_value);

  // Матриця без числа — це не «інше число» (AC-05), а нічого, з чим порівняти.
  // Divergence тут кликав би людину ухвалювати рішення по неіснуючій різниці.
  if (matrixNumber === null) {
    return {
      rule_id,
      state: STATES.UNAVAILABLE,
      matrix_value,
      fetched_value: fetchedNumber,
      diff_percent: null,
      failure_reason: `matrix_value не нормалізується: ${JSON.stringify(matrix_value)}`,
      fetched_from,
      source_url,
      verified_at,
    };
  }

  const diffPercent =
    matrixNumber === 0
      ? null
      : Math.round(((fetchedNumber - matrixNumber) / matrixNumber) * 100 * 100) / 100;

  return {
    rule_id,
    state: STATES.DIVERGENCE,
    matrix_value,
    fetched_value: fetchedNumber,
    diff_percent: diffPercent,
    failure_reason: null,
    fetched_from,
    source_url,
    verified_at,
  };
}
