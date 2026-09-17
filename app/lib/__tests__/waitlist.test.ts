import { describe, expect, it } from 'vitest';
import { WAITLIST_URL, waitlistHref } from '../waitlist';

describe('waitlistHref', () => {
  it('без налаштованої форми кнопки немає', () => {
    expect(waitlistHref(null)).toBeNull();
    expect(waitlistHref('')).toBeNull();
  });

  it('пропускає https-адресу форми на tally.so', () => {
    expect(waitlistHref('https://tally.so/r/abc123')).toBe('https://tally.so/r/abc123');
  });

  // Кожен кейс нижче або міняє обробника даних, або дає шлях винести відповіді анкети з клієнта.
  it.each([
    ['http замість https', 'http://tally.so/r/abc123'],
    ['чужий хост', 'https://forms.gle/abc123'],
    ['піддомен-двійник', 'https://tally.so.evil.test/r/abc123'],
    ['query-параметри', 'https://tally.so/r/abc123?income=9000'],
    ['fragment', 'https://tally.so/r/abc123#income=9000'],
    ['не URL', 'tally.so/r/abc123'],
  ])('відкидає: %s', (_label, url) => {
    expect(waitlistHref(url)).toBeNull();
  });

  it('налаштована адреса проходить власну перевірку', () => {
    if (WAITLIST_URL !== null) expect(waitlistHref()).toBe(WAITLIST_URL);
    else expect(waitlistHref()).toBeNull();
  });
});
