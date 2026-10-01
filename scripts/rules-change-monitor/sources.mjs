// Фетч сторінки-джерела. Що саме з неї брати — `pages.mjs` (реєстр сторінок)
// і `extract.mjs` (витяг); тут лише запит і чесна причина, якщо він не вдався.

import { challengeReason, detectChallenge } from "./challenge.mjs";

/**
 * Скільки чекаємо сторінку. Довше за це — цикл важливіший за одне джерело.
 * 30 с, а не 15: biznes.gov.pl/00115 віддає сторінку стабільно за ~17 с
 * (три заміри 2026-10-01), і 15 с робили три правила `unavailable` щоциклу.
 * Бюджет QG-3 (15 хв) це покриває: сторінок у реєстрі десять.
 */
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * Фетч однієї сторінки. Мережеву помилку НЕ ковтає і не перетворює на порожній
 * рядок: порожнє від недоступного джерела читалось би далі як «нема змін».
 *
 * @returns {Promise<{ html: string|null, failure_reason: string|null }>}
 */
export async function fetchSource(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    // Тіло читаємо і на помилковому коді: 403 від WAF і 403 від самого сайту
    // вимагають різної реакції, а різницю видно лише зі сторінки.
    const body = await response.text().catch(() => null);
    const vendor = detectChallenge(body);
    if (vendor) {
      return { html: null, failure_reason: challengeReason(vendor, response.status) };
    }
    if (!response.ok) {
      return { html: null, failure_reason: `джерело відповіло ${response.status}` };
    }
    return { html: body, failure_reason: null };
  } catch (error) {
    return { html: null, failure_reason: `запит не вдався: ${error?.message ?? error}` };
  } finally {
    clearTimeout(timer);
  }
}
