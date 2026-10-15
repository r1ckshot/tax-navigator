import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubUrl } from '../analytics';
import { ANSWER_PAGES } from '../content';
import { LOCALES } from '../i18n';
import { COUNTRY_PAGES, alternates, answerAlternates } from '../routes';
import { robotsRules, sitemapEntries } from '../seo';
import { siteUrl } from '../site';

const BASE = siteUrl({ NEXT_PUBLIC_APP_URL: 'https://nettomap.com' });
const sitemap = sitemapEntries(BASE);
const urls = sitemap.map((e) => e.url);

describe('sitemap.xml', () => {
  it('адреси абсолютні від базової адреси з env, а не від Vercel', () => {
    for (const url of urls) expect(url.startsWith('https://nettomap.com/')).toBe(true);
  });

  it('бренд, країна, анкета, джерела — для кожної мови', () => {
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://nettomap.com/',
        'https://nettomap.com/uk/poland',
        'https://nettomap.com/uk/poland/questionnaire',
        'https://nettomap.com/uk/poland/sources',
      ]),
    );
  });

  // Guard «кожна сторінка-відповідь є в sitemap»: список береться з реєстру,
  // тож нова сторінка без рядка тут падає, а не зникає з пошуку.
  it('кожна сторінка-відповідь з реєстру є в sitemap', () => {
    for (const locale of LOCALES) {
      for (const { slug } of ANSWER_PAGES[locale]) expect(urls).toContain(`https://nettomap.com/${locale}/poland/${slug}`);
    }
  });

  // Нова статична сторінка країни без місця в COUNTRY_PAGES не потрапила б ні в
  // sitemap, ні в перевірку slug-ів. Список тек — те, що реально віддає Next.
  it('кожна статична сторінка в app/[locale]/poland є в COUNTRY_PAGES', () => {
    const dir = fileURLToPath(new URL('../../[locale]/poland', import.meta.url));
    const pages = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('['))
      .map((d) => d.name)
      .sort();
    expect(pages).toEqual([...COUNTRY_PAGES].sort());
  });

  it('технічних і повторних адрес немає: /tokens, /uk (дубль /), query', () => {
    expect(urls.some((u) => u.includes('/tokens'))).toBe(false);
    expect(urls).not.toContain('https://nettomap.com/uk');
    expect(urls.some((u) => u.includes('?'))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });

  // Карта й метадані сторінки мусять казати одне: hreflang з однієї функції.
  it('сторінка-відповідь у карті має ті самі hreflang, що й у метаданих', () => {
    const entry = sitemap.find((e) => e.url === 'https://nettomap.com/uk/poland/ryczalt-it')!;
    expect(entry.alternates?.languages).toEqual({
      uk: 'https://nettomap.com/uk/poland/ryczalt-it',
      'x-default': 'https://nettomap.com/uk/poland/ryczalt-it',
    });
  });

  it('hreflang у карті — абсолютні, з x-default', () => {
    const sources = sitemap.find((e) => e.url === 'https://nettomap.com/uk/poland/sources')!;
    expect(sources.alternates?.languages).toEqual({
      uk: 'https://nettomap.com/uk/poland/sources',
      'x-default': 'https://nettomap.com/uk/poland/sources',
    });
  });
});

describe('robots.txt', () => {
  it('усе відкрито і вказано абсолютну адресу sitemap', () => {
    expect(robotsRules(BASE)).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://nettomap.com/sitemap.xml',
    });
  });
});

describe('canonical і hreflang у метаданих', () => {
  it('сторінка країни: canonical своєї мови, hreflang кожної мови й x-default', () => {
    expect(alternates('uk', 'questionnaire')).toEqual({
      canonical: '/uk/poland/questionnaire',
      languages: { uk: '/uk/poland/questionnaire', 'x-default': '/uk/poland/questionnaire' },
    });
  });

  it('сторінка-відповідь: hreflang лише на мови, де її написано', () => {
    expect(answerAlternates('uk', 'ryczalt-it', ['uk'])).toEqual({
      canonical: '/uk/poland/ryczalt-it',
      languages: { uk: '/uk/poland/ryczalt-it', 'x-default': '/uk/poland/ryczalt-it' },
    });
  });

  it('немає версії мовою за замовчуванням — x-default на першу наявну', () => {
    // Мова `en` ще не увімкнена; тип перевіряється на реєстрі, тож приведення.
    const en = 'en' as (typeof LOCALES)[number];
    expect(answerAlternates(en, 'x', [en]).languages['x-default']).toBe('/en/poland/x');
  });

  it('базова адреса: env → прод Vercel → локальна', () => {
    expect(siteUrl({ NEXT_PUBLIC_APP_URL: 'https://nettomap.com' }).href).toBe('https://nettomap.com/');
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'tax-navigator-red.vercel.app' }).href).toBe(
      'https://tax-navigator-red.vercel.app/',
    );
    expect(siteUrl({}).href).toBe('http://localhost:3000/');
  });
});

describe('аналітика: що залишає браузер', () => {
  it('share-лінк з відповідями → лише шлях', () => {
    expect(scrubUrl('https://nettomap.com/uk/poland/questionnaire?b=ukr&d=gte183&r=15000')).toBe(
      'https://nettomap.com/uk/poland/questionnaire',
    );
  });

  it('передзаповнення і #якір теж знімаються', () => {
    expect(scrubUrl('https://nettomap.com/uk/poland/questionnaire?w=programming&start=1#x')).toBe(
      'https://nettomap.com/uk/poland/questionnaire',
    );
  });

  it('подія зберігає решту полів, змінюється лише url', () => {
    expect(scrubEvent({ type: 'pageview', url: 'https://nettomap.com/uk/poland?a=1' })).toEqual({
      type: 'pageview',
      url: 'https://nettomap.com/uk/poland',
    });
  });
});
