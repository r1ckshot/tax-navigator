import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config.mjs';
import { LEGACY_REDIRECTS, alternates, countryHref } from '../routes';
import { siteUrl } from '../site';

describe('адреси /{мова}/poland (ADR-0003)', () => {
  it('сторінки країни — під мовою, без слеша в кінці', () => {
    expect(countryHref('uk')).toBe('/uk/poland');
    expect(countryHref('uk', 'questionnaire')).toBe('/uk/poland/questionnaire');
    expect(countryHref('uk', 'sources')).toBe('/uk/poland/sources');
  });

  it('canonical — своя мова, hreflang — кожна увімкнена мова плюс x-default', () => {
    expect(alternates('uk', 'sources')).toEqual({
      canonical: '/uk/poland/sources',
      languages: { uk: '/uk/poland/sources', 'x-default': '/uk/poland/sources' },
    });
  });
});

/**
 * Старі адреси живуть у розісланих share-лінках. Редирект — у `next.config.mjs`,
 * який не імпортує TypeScript, тож тут звіряється, що копія в конфігу та сама,
 * що в `routes.ts`, і веде на сторінки, які реально існують.
 */
describe('редиректи зі старих адрес', () => {
  it('next.config.mjs віддає рівно LEGACY_REDIRECTS', async () => {
    expect(await nextConfig.redirects?.()).toEqual(LEGACY_REDIRECTS);
  });

  it('/ — тимчасовий (там буде лендінг бренду), анкета й джерела — постійні', () => {
    const bySource = Object.fromEntries(LEGACY_REDIRECTS.map((r) => [r.source, r]));
    expect(bySource['/']).toEqual({ source: '/', destination: '/uk/poland', permanent: false });
    expect(bySource['/questionnaire']).toEqual({
      source: '/questionnaire',
      destination: '/uk/poland/questionnaire',
      permanent: true,
    });
    expect(bySource['/sources']).toEqual({ source: '/sources', destination: '/uk/poland/sources', permanent: true });
  });

  // Next переносить query в ціль сам, лише якщо ціль свого query не має.
  // Ціль із `?` тихо відрізала б відповіді з share-лінка.
  it('ціль без власного query й fragment — інакше відповіді з лінка загубились би', () => {
    for (const r of LEGACY_REDIRECTS) expect(r.destination).not.toMatch(/[?#]/);
  });

  it('/tokens лишається технічною сторінкою: редиректу немає', () => {
    expect(LEGACY_REDIRECTS.map((r) => r.source)).not.toContain('/tokens');
  });

  it('404 без спільного кореневого layout вмикається прапором', () => {
    expect(nextConfig.experimental?.globalNotFound).toBe(true);
  });
});

describe('базова адреса сайту', () => {
  it('змінна з env має пріоритет — переїзд на домен не чіпає коду', () => {
    expect(
      siteUrl({ NEXT_PUBLIC_APP_URL: 'https://nettomap.com', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' }).href,
    ).toBe('https://nettomap.com/');
  });

  it('без змінної — продакшн-адреса Vercel, і на превʼю теж', () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'tax-navigator-red.vercel.app' }).href).toBe(
      'https://tax-navigator-red.vercel.app/',
    );
  });

  it('локально — свій сервер', () => {
    expect(siteUrl({}).href).toBe('http://localhost:3000/');
  });
});
