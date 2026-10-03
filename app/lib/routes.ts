import { DEFAULT_LOCALE, LOCALES, type Locale } from './i18n';

/**
 * Адреси продукту: `/{мова}/poland/…` (ADR-0003). Країна — статична тека
 * `app/[locale]/poland/`, тож і тут вона стала, а не параметр.
 *
 * Шляхи без слеша в кінці: так Next віддає сторінку сам (`trailingSlash: false`),
 * і редирект зі старої адреси не робить другого стрибка.
 */
export const COUNTRY = 'poland';

export type CountryPage = 'home' | 'questionnaire' | 'sources';

export function countryHref(locale: Locale, page: CountryPage = 'home'): string {
  const base = `/${locale}/${COUNTRY}`;
  return page === 'home' ? base : `${base}/${page}`;
}

/**
 * Старі адреси, які вже живуть у розісланих лінках, і куди вони ведуть.
 * `next.config.mjs` тримає копію (конфіг не імпортує TypeScript); тест
 * `routes.test.ts` звіряє, що вони не розійшлись.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<{ source: string; destination: string; permanent: boolean }> = [
  // Тимчасовий: `/` стане лендінгом бренду в темі 2.2.
  { source: '/', destination: countryHref(DEFAULT_LOCALE), permanent: false },
  { source: '/questionnaire', destination: countryHref(DEFAULT_LOCALE, 'questionnaire'), permanent: true },
  { source: '/sources', destination: countryHref(DEFAULT_LOCALE, 'sources'), permanent: true },
];

/**
 * Canonical і hreflang сторінки. Шляхи відносні: абсолютними їх робить
 * `metadataBase` з `siteUrl()`. `x-default` веде на мову за замовчуванням —
 * мова не обирається редиректом за IP (DECISIONS 2026-10-01).
 */
export function alternates(locale: Locale, page: CountryPage = 'home') {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = countryHref(l, page);
  languages['x-default'] = countryHref(DEFAULT_LOCALE, page);
  return { canonical: countryHref(locale, page), languages };
}
