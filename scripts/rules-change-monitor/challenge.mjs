// Розпізнавання challenge-сторінки WAF (PRD §6.1, CONTEXT.md `challenge_page`).
//
// Пастка не в тому, що джерело недоступне, а в тому, що воно виглядає
// доступним. `isap.sejm.gov.pl` за Incapsula віддає challenge з кодом 200, якщо
// йти за редиректом, а `fetch` за ним іде за замовчуванням. Далі екстрактор
// шукає число в чужому HTML, і будь-яка сума на такій сторінці стала б
// «значенням джерела».
//
// Сигнатури — лише з живих відповідей, знятих 2026-09-16 (фікстури
// `__fixtures__/waf-*.html`), звужені 2026-10-01 справжньою сторінкою
// podatki.gov.pl. Вендорів, чиїх сторінок ми не бачили, тут немає: вигадана
// сигнатура або мовчить завжди, або ловить справжній контент.

/**
 * @type {ReadonlyArray<{ vendor: string, pattern: RegExp }>}
 */
export const CHALLENGE_SIGNATURES = Object.freeze([
  // Ловимо iframe challenge (`SWUDNSAI`) і його текст, а НЕ сам шлях
  // `_Incapsula_Resource`. З 2026-10-01 podatki.gov.pl вшиває скрипт
  // `_Incapsula_Resource?SWJIYLWA=…` у кожну справжню сторінку зі ставками, і
  // сигнатура за шляхом позначала б усі правила podatki як «заблоковано».
  { vendor: "incapsula", pattern: /_Incapsula_Resource\?SWUDNSAI|Incapsula incident ID/i },
  // Сторінка відмови Akamai посилається на свій сервіс помилок, і посилання
  // закодоване HTML-сутностями (`errors&#46;edgesuite&#46;net`). Шукаємо обидві
  // форми, бо звичайна крапка на такій сторінці не трапляється зовсім.
  { vendor: "akamai", pattern: /errors(?:\.|&#46;)edgesuite(?:\.|&#46;)net/i },
]);

/**
 * Назва вендора, якщо HTML — challenge-сторінка WAF, або null.
 *
 * @param {unknown} html
 * @returns {string|null}
 */
export function detectChallenge(html) {
  if (typeof html !== "string" || html === "") return null;
  const hit = CHALLENGE_SIGNATURES.find(({ pattern }) => pattern.test(html));
  return hit ? hit.vendor : null;
}

/** Причина для `failure_reason`: термін із CONTEXT.md плюс вендор. */
export function challengeReason(vendor, status) {
  return `challenge_page (${vendor}): джерело віддало сторінку WAF з кодом ${status}, а не контент`;
}
