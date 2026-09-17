/**
 * Лист очікування G1: зовнішня форма за звичайним посиланням (DECISIONS 2026-09-17).
 *
 * Сервера й бази в продукту немає (SPEC.md, non-goal 3), тож email збирає
 * хостована форма, а сюди потрапляє лише її адреса. Відповіді анкети туди не
 * передаються: у лінку немає query-параметрів, і це тримає `waitlistHref`.
 *
 * Поки форми немає, `WAITLIST_URL` порожній і CTA чесно каже «Скоро».
 */
export const WAITLIST_URL: string | null = null;

/** Єдиний дозволений хост. Інший домен означає іншого обробника даних і нове рішення. */
export const WAITLIST_HOST = 'tally.so';

/**
 * Адреса для кнопки або `null`, якщо показувати нема чого. Відкидає все, що
 * могло б винести дані з клієнта: не https, чужий хост, query чи fragment.
 */
export function waitlistHref(url: string | null = WAITLIST_URL): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname !== WAITLIST_HOST) return null;
  if (parsed.search || parsed.hash) return null;
  return parsed.href;
}
