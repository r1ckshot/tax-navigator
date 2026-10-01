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
 *
 * `biznes.gov.pl` і `www.gov.pl` додані 2026-10-01: обидва віддали скрипту
 * справжній контент (`200`, без challenge). Для gov.pl записано саме `www.gov.pl`,
 * а не apex: збіг іде за суфіксом, і `gov.pl` відкрив би кожен піддомен держави,
 * включно з `isap.sejm.gov.pl` за WAF.
 */
export const SCRIPTABLE_HOSTS = Object.freeze(['zus.pl', 'podatki.gov.pl', 'biznes.gov.pl', 'www.gov.pl']);

/** Хост із URL, або null, якщо URL невалідний. */
export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Домен, до якого відноситься URL, для паузи між запитами: запис
 * `SCRIPTABLE_HOSTS`, якщо хост — він сам або піддомен, інакше сам хост.
 * `www.zus.pl` і `zus.pl` — один сервер для WAF, і пауза між ними однакова.
 */
export function domainOf(url) {
  const host = hostOf(url);
  if (host === null) return null;
  return SCRIPTABLE_HOSTS.find((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ?? host;
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
 * `null`, коли правило у скоупі й його треба фетчити далі. `url` — сторінка,
 * яку цикл справді відкриє; без нього перевіряється `source_url`.
 *
 * Порядок перевірок навмисний: відсутність `verified_at` перевіряється
 * ПЕРШОЮ, бо звіряти нема з чим незалежно від того, чи джерело скриптується —
 * спершу потрібна ручна верифікація, лише тоді має сенс питати про джерело.
 */
export function classifyScope(rule, url = rule.source_url) {
  const unverified = notVerifiedScope(rule);
  if (unverified) return unverified;

  if (!url || !isScriptable(url)) {
    return {
      state: STATES.OUT_OF_SCOPE,
      failure_reason: 'джерело відсутнє або не входить у SCRIPTABLE_HOSTS',
    };
  }

  return null;
}

/**
 * Лише перша з двох перевірок: чи є з чим звіряти. Цикл питає її окремо, бо
 * сторінку для запиту він обирає пізніше — за способом звірки, а не за
 * `source_url`.
 */
export function notVerifiedScope(rule) {
  if (rule.verified_at) return null;
  return {
    state: STATES.NOT_VERIFIED,
    failure_reason: 'у матриці немає verified_at — звіряти нема з чим',
  };
}
