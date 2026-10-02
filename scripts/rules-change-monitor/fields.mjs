// Звірка правила по полях (`pages.mjs`) і зведення полів в один запис правила.
//
// Контракт циклу не змінюється: на правило — рівно один `RuleCheck` із семи
// станів (AC-03). Поля їдуть усередині запису (`fields`), а стан правила —
// найгірший зі станів його полів: правило «збігається», лише коли збіглось усе,
// що сторінка взагалі може підтвердити.

import { compareValues } from "./diff.mjs";
import { isoFromPolishDate, pick } from "./extract.mjs";
import { valueAt } from "./methods.mjs";
import { STATES } from "./states.mjs";
import { applyVeto } from "./veto.mjs";

/**
 * Від найважчого до найлегшого. Ветована цифра і розбіжність вимагають
 * рішення людини, тож стоять вище за «не вдалось»: недоступне поле поруч із
 * розбіжністю не має ховати розбіжність під «погану погоду». Але `unavailable`
 * вище за `match`: одне не перевірене поле робить правило не перевіреним.
 */
const SEVERITY = Object.freeze([
  STATES.NEEDS_CONFIRMATION,
  STATES.DIVERGENCE,
  STATES.UNAVAILABLE,
  STATES.COSMETIC,
  STATES.MATCH,
]);

/**
 * Матричне значення в одиницях сторінки. Округлення — через двійкову
 * арифметику: 0.0245 × 100 дає 2.4499999999999997, і таке число у звіті
 * читалось би як розбіжність, хоча нею не є.
 */
function scaled(value, scale = 1) {
  if (typeof value !== "number") return value;
  return Math.round(value * scale * 1e6) / 1e6;
}

/**
 * Один запис поля. `text` — уже очищений текст сторінки або null, якщо
 * сторінку не дістали (тоді `failure_reason` несе причину).
 */
export function checkField({ rule, param, field, url, text, failure_reason, vetoes = [] }) {
  const base = {
    rule_id: rule.rule_id,
    param,
    fetched_from: url,
    source_url: rule.source_url ?? null,
    verified_at: rule.verified_at ?? null,
  };
  const matrix = valueAt(rule.params, param);

  if (field.kind === "quote") {
    if (failure_reason || text === null) {
      return { ...base, state: STATES.UNAVAILABLE, matrix_value: matrix, fetched_value: null, diff_percent: null, failure_reason: failure_reason ?? "сторінку не отримано" };
    }
    const found = field.quote.test(text);
    return {
      ...base,
      state: found ? STATES.MATCH : STATES.UNAVAILABLE,
      matrix_value: matrix,
      fetched_value: found ? matrix : null,
      diff_percent: null,
      failure_reason: found ? null : "опорної фрази на сторінці більше немає — текст переписано, твердження перечитати очима",
    };
  }

  if (field.kind === "date") {
    const raw = failure_reason ? null : pick(text, field);
    const iso = isoFromPolishDate(raw);
    if (iso === null) {
      return { ...base, state: STATES.UNAVAILABLE, matrix_value: matrix, fetched_value: null, diff_percent: null, failure_reason: failure_reason ?? `дату за маркером не знайдено: ${JSON.stringify(raw)}` };
    }
    return {
      ...base,
      state: iso === matrix ? STATES.MATCH : STATES.DIVERGENCE,
      matrix_value: matrix,
      fetched_value: iso,
      diff_percent: null,
      failure_reason: null,
    };
  }

  const check = compareValues({
    rule_id: rule.rule_id,
    matrix_value: scaled(matrix, field.scale),
    fetched_raw: failure_reason ? null : pick(text, field),
    fetched_from: url,
    source_url: base.source_url,
    verified_at: base.verified_at,
    failure_reason,
  });
  if (check.state === STATES.UNAVAILABLE && !failure_reason && check.failure_reason === "fetched_raw порожній") {
    check.failure_reason = "число за маркером не знайдено — сторінку перебудовано або значення прибрано";
  }
  // Veto по полю, а не по правилу: ветована цифра — це конкретна ставка, і в
  // правилі з трьома ставками вона збігається лише з однією з них.
  return { ...applyVeto(check, vetoes), param, ...(field.scale ? { scale: field.scale } : {}) };
}

/**
 * Запис правила з його полів. Верхні поля (`matrix_value`, `fetched_value`,
 * `param`) — від поля, що визначило стан: саме його людина має побачити першим.
 */
export function aggregateFields(rule, fieldChecks) {
  const deciding = [...fieldChecks].sort((a, b) => SEVERITY.indexOf(a.state) - SEVERITY.indexOf(b.state))[0];
  const same = fieldChecks.filter((f) => f.state === deciding.state).length;
  const reason = deciding.failure_reason === null ? null : `${deciding.param}: ${deciding.failure_reason}${same > 1 ? ` (і ще полів у цьому стані: ${same - 1})` : ""}`;
  // Відхилений вхід на будь-якому полі робить відхиленим правило, навіть коли
  // стан визначило інше поле: інакше статус циклу `blocked` його б не побачив.
  const blocked = fieldChecks.some((f) => f.blocked === true);
  return {
    ...deciding,
    rule_id: rule.rule_id,
    failure_reason: reason,
    ...(blocked ? { blocked: true } : {}),
    fields: fieldChecks,
  };
}
