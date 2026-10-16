/**
 * Що йде у Vercel Web Analytics з кожним переглядом: адреса сторінки без query
 * і без `#`. У query живуть відповіді share-лінка (`?b=ukr&r=15000…`) і
 * передзаповнення анкети — вони не мають залишати браузер навіть як рядок
 * адреси. Шлях лишається: з нього видно, яку сторінку відкрили, а відповіді анкети
 * в шлях не потрапляють ніколи.
 *
 * Чиста функція над рядком, без `window`: компонент `Analytics` передає її в
 * `beforeSend`, тест перевіряє без браузера.
 */
export function scrubUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

export function scrubEvent<E extends { url: string }>(event: E): E {
  return { ...event, url: scrubUrl(event.url) };
}
