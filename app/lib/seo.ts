import type { MetadataRoute } from 'next';
import { localesOf } from '@/lib/answer-page';
import { ANSWER_PAGES } from '@/lib/content';
import { engineLocalesOf, engineSlugs } from '@/lib/engine-page';
import { LOCALES } from '@/lib/i18n';
import { COUNTRY_PAGES, alternates, answerAlternates, brandHref } from '@/lib/routes';

/**
 * Карта сайту й robots.txt як дані: `app/sitemap.ts` і `app/robots.ts` лише
 * віддають результат. Адреси абсолютні від `siteUrl()` — переїзд на власний
 * домен (тема 5.1) міняє змінну, а не цей файл.
 *
 * У карті — лише сторінки для людей з пошуку: лендінг бренду, лендінг країни,
 * анкета, джерела, кожна сторінка-відповідь і кожна сторінка з движка. `/tokens` технічна і закрита
 * `noindex`; share-лінки з відповідями — та сама анкета з query, окремих адрес
 * не мають.
 */
export function sitemapEntries(base: URL): MetadataRoute.Sitemap {
  const abs = (path: string) => new URL(path, base).toString();
  const absAll = (languages: Record<string, string>) =>
    Object.fromEntries(Object.entries(languages).map(([lang, path]) => [lang, abs(path)]));

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    entries.push({ url: abs(brandHref(locale)) });

    for (const page of ['home', ...COUNTRY_PAGES] as const) {
      const { canonical, languages } = alternates(locale, page);
      entries.push({ url: abs(canonical), alternates: { languages: absAll(languages) } });
    }

    for (const { slug } of ANSWER_PAGES[locale]) {
      const { canonical, languages } = answerAlternates(locale, slug, localesOf(slug));
      entries.push({ url: abs(canonical), alternates: { languages: absAll(languages) } });
    }

    for (const slug of engineSlugs(locale)) {
      const { canonical, languages } = answerAlternates(locale, slug, engineLocalesOf(slug));
      entries.push({ url: abs(canonical), alternates: { languages: absAll(languages) } });
    }
  }

  return entries;
}

export function robotsRules(base: URL): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', base).toString(),
  };
}
