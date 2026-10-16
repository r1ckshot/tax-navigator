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
 * Лендінг бренду: мова за замовчуванням живе на `/`, решта — на `/{мова}`.
 * Сторінка одна (`app/[locale]/page.tsx`), а `/` віддає її rewrite-ом, не
 * редиректом: адреса в рядку лишається короткою, а лендінг ділить layout,
 * шрифти й шапку з країною.
 */
export function brandHref(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '/' : `/${locale}`;
}

/** `/` → сторінка бренду мови за замовчуванням. Копія — у `next.config.mjs`. */
export const BRAND_REWRITES: ReadonlyArray<{ source: string; destination: string }> = [
  { source: '/', destination: `/${DEFAULT_LOCALE}` },
];

/**
 * Старі адреси, які вже живуть у розісланих лінках, і куди вони ведуть.
 * `next.config.mjs` тримає копію (конфіг не імпортує TypeScript); тест
 * `routes.test.ts` звіряє, що вони не розійшлись.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<{ source: string; destination: string; permanent: boolean }> = [
  { source: '/questionnaire', destination: countryHref(DEFAULT_LOCALE, 'questionnaire'), permanent: true },
  { source: '/sources', destination: countryHref(DEFAULT_LOCALE, 'sources'), permanent: true },
];

/**
 * Сторінка-відповідь: `/{мова}/poland/<slug>`. Slug не може збігтися зі
 * статичною сторінкою країни — Next віддав би статичну, і сторінка зникла б
 * мовчки (тест `answer-page.test.ts`).
 */
export const COUNTRY_PAGES: readonly Exclude<CountryPage, 'home'>[] = ['questionnaire', 'sources'];

export function answerHref(locale: Locale, slug: string): string {
  return `${countryHref(locale)}/${slug}`;
}

/**
 * Canonical і hreflang сторінки. Шляхи відносні: абсолютними їх робить
 * `metadataBase` з `siteUrl()`. `x-default` веде на мову за замовчуванням —
 * мова не обирається редиректом за IP (DECISIONS 2026-10-01).
 */
export function alternates(locale: Locale, page: CountryPage = 'home') {
  return alternatesOf(locale, (l) => countryHref(l, page), LOCALES);
}

/**
 * Те саме для сторінки-відповіді, яка є лише в мовах, де її написано: hreflang
 * не має вести на 404. Немає версії мовою за замовчуванням — `x-default` на
 * першу наявну.
 */
export function answerAlternates(locale: Locale, slug: string, available: readonly Locale[]) {
  return alternatesOf(locale, (l) => answerHref(l, slug), available);
}

function alternatesOf(locale: Locale, href: (l: Locale) => string, available: readonly Locale[]) {
  const languages: Record<string, string> = {};
  for (const l of available) languages[l] = href(l);
  languages['x-default'] = href(available.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : available[0]);
  return { canonical: href(locale), languages };
}
