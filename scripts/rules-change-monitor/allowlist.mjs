// Чи взагалі підлягає правило автозвірці — без жодного звернення до мережі.
// Порядок і причина: спершу перевіряємо, чи є з чим звіряти (verified_at),
// тоді — чи джерело фізично скриптується (allowlist хостів). Дальші кроки
// (фетч, normalize, diff) цей модуль не робить.

import { STATES } from './states.mjs';

/**
 * Хости, чиї сторінки реально скриптуються curl-ом.
 *
 * `tax.gov.ua` і `isap.sejm.gov.pl` свідомо НЕ тут: обидва сидять за WAF
 * (Akamai і Incapsula відповідно) і віддають 403 будь-якому curl незалежно
 * від User-Agent чи cookie-jar. Це не здогадка — задокументована й перевірена
 * межа середовища, `.claude/rules/environment-limits.md`.
 */
export const SCRIPTABLE_HOSTS = Object.freeze(['zus.pl', 'podatki.gov.pl']);

/** Хост із URL, або null, якщо URL невалідний. */
export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * true, якщо хост URL дорівнює одному з `SCRIPTABLE_HOSTS` або є його
 * піддоменом, і протокол https. Звіряємо через `endsWith('.' + host)`, а не
 * `includes`, щоб `zus.pl.evil.com` (де `zus.pl` — префікс іншого домену,
 * не піддомен) не пройшов.
 */
export function isScriptable(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname;
  return SCRIPTABLE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Чи підлягає запис правила автозвірці.
 *
 * Повертає `{ state, failure_reason }`, коли звірку робити НЕ можна, або
 * `null`, коли правило у скоупі й його треба фетчити далі.
 *
 * Порядок перевірок навмисний: відсутність `verified_at` перевіряється
 * ПЕРШОЮ, бо звіряти нема з чим незалежно від того, чи джерело скриптується —
 * спершу потрібна ручна верифікація, лише тоді має сенс питати про джерело.
 */
export function classifyScope(rule) {
  if (!rule.verified_at) {
    return {
      state: STATES.NOT_VERIFIED,
      failure_reason: 'у матриці немає verified_at — звіряти нема з чим',
    };
  }

  if (!rule.source_url || !isScriptable(rule.source_url)) {
    return {
      state: STATES.OUT_OF_SCOPE,
      failure_reason: 'джерело відсутнє або не входить у SCRIPTABLE_HOSTS',
    };
  }

  return null;
}
