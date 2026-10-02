// Фетч сторінки-джерела. Що саме з неї брати — `pages.mjs` (реєстр сторінок)
// і `extract.mjs` (витяг); тут лише запит і чесна причина, якщо він не вдався.

import { createHash } from "node:crypto";

import { challengeReason, detectChallenge } from "./challenge.mjs";

/**
 * Скільки чекаємо сторінку. Довше за це — цикл важливіший за одне джерело.
 * 30 с, а не 15: biznes.gov.pl/00115 віддає сторінку стабільно за ~17 с
 * (три заміри 2026-10-01), і 15 с робили три правила `unavailable` щоциклу.
 * Бюджет QG-3 (15 хв) це покриває: сторінок у реєстрі десять.
 */
export const FETCH_TIMEOUT_MS = 30_000;

/**
 * Збої, за яких запит не дійшов до сервера: TCP-з'єднання не встановилось.
 * Лише їх повторюємо — один раз. zakon.rada.gov.ua (один статичний IP) не
 * з'єднується приблизно в одній спробі з чотирьох, а повтор за кілька секунд
 * проходить (заміри 2026-10-01). Відповідь сервера, хай і 403 чи 500, не
 * повторюється ніколи: це вже його слово, і пауза між запитами (`sad.md` §4,
 * без адаптивного backoff) лишається єдиною поведінкою щодо навантаження.
 */
export const CONNECT_ERRORS = Object.freeze(["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN"]);
export const CONNECT_RETRY_DELAY_MS = 3_000;

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Фетч однієї сторінки. Мережеву помилку НЕ ковтає і не перетворює на порожній
 * рядок: порожнє від недоступного джерела читалось би далі як «нема змін».
 *
 * @returns {Promise<{ html: string|null, failure_reason: string|null }>}
 */
export async function fetchSource(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS, sleep = realSleep, retryDelayMs = CONNECT_RETRY_DELAY_MS } = {}) {
  return withConnectRetry(() => fetchOnce(url, { fetchImpl, timeoutMs, bytes: false }), { sleep, retryDelayMs });
}

/**
 * Відбиток файла (sha256 сирих байтів) — для документа, у якого немає дати
 * редакції (PDF `laws.mjs`). Текст із файла нікуди не йде: ні в звіт, ні до
 * моделі, тож і перевірка `screen.mjs` йому не потрібна.
 *
 * @returns {Promise<{ sha256: string|null, failure_reason: string|null }>}
 */
export async function fetchDigest(url, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS, sleep = realSleep, retryDelayMs = CONNECT_RETRY_DELAY_MS } = {}) {
  return withConnectRetry(() => fetchOnce(url, { fetchImpl, timeoutMs, bytes: true }), { sleep, retryDelayMs });
}

async function withConnectRetry(once, { sleep, retryDelayMs }) {
  const first = await once();
  if (!first.connectFailed) return first.result;
  await sleep(retryDelayMs);
  return (await once()).result;
}

async function fetchOnce(url, { fetchImpl, timeoutMs, bytes }) {
  const empty = bytes ? { sha256: null } : { html: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    // Тіло читаємо і на помилковому коді: 403 від WAF і 403 від самого сайту
    // вимагають різної реакції, а різницю видно лише зі сторінки.
    const raw = bytes ? Buffer.from(await response.arrayBuffer().catch(() => new ArrayBuffer(0))) : null;
    const body = bytes ? raw.toString("utf8") : await response.text().catch(() => null);
    const vendor = detectChallenge(body);
    if (vendor) {
      return { result: { ...empty, failure_reason: challengeReason(vendor, response.status) } };
    }
    if (!response.ok) {
      return { result: { ...empty, failure_reason: `джерело відповіло ${response.status}` } };
    }
    if (bytes) return { result: { sha256: createHash("sha256").update(raw).digest("hex"), failure_reason: null } };
    return { result: { html: body, failure_reason: null } };
  } catch (error) {
    // undici кладе справжню причину в `cause`: без неї звіт казав би лише
    // «fetch failed», і таймаут з'єднання (IP поза фаєрволом) не відрізнявся б
    // від відмови сервера.
    const code = error?.cause?.code ?? null;
    return {
      connectFailed: CONNECT_ERRORS.includes(code),
      result: { ...empty, failure_reason: `запит не вдався: ${error?.message ?? error}${code ? ` (${code})` : ""}` },
    };
  } finally {
    clearTimeout(timer);
  }
}
