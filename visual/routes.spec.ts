import { expect, test } from '@playwright/test';
import { encodeAnswers } from '../app/lib/share';
import { baseAnswers } from '../app/lib/calc/__tests__/fixtures';
import { countryHref } from '../app/lib/routes';

/**
 * Адреси `/{мова}/poland` і старі лінки (ADR-0003). Не скріншоти, а поведінка
 * сервера, тож живе тут: лише на CI є зібраний `next start`, а редиректи з
 * `next.config.mjs` у jsdom не перевірити.
 *
 * Матриця тем і вʼюпортів тут нічого не додає — один проєкт досить.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'поведінка сервера не залежить від теми й ширини');
});

const QUERY = encodeAnswers(baseAnswers);
const QUESTIONNAIRE = countryHref('uk', 'questionnaire');

/** Location буває відносним; порівнюємо шлях і query, а не рядок цілком. */
async function redirectOf(request: import('@playwright/test').APIRequestContext, path: string) {
  const response = await request.get(path, { maxRedirects: 0 });
  const location = new URL(response.headers()['location'] ?? '', 'http://x');
  return { status: response.status(), target: `${location.pathname}${location.search}` };
}

test('старі адреси: / тимчасово, анкета й джерела постійно, query на місці', async ({ request }) => {
  expect(await redirectOf(request, '/')).toEqual({ status: 307, target: '/uk/poland' });
  expect(await redirectOf(request, '/sources')).toEqual({ status: 308, target: '/uk/poland/sources' });
  expect(await redirectOf(request, `/questionnaire?${QUERY}`)).toEqual({
    status: 308,
    target: `${QUESTIONNAIRE}?${QUERY}`,
  });
});

/**
 * Головне, від чого живуть розіслані share-лінки: старий лінк відкриває той
 * самий результат, що й новий, разом із fragment.
 */
test('старий share-лінк відкриває той самий результат, що й новий', async ({ page }) => {
  await page.goto(`${QUESTIONNAIRE}?${QUERY}`);
  await expect(page.locator('details')).toHaveCount(6);
  const expected = await page.getByRole('table').first().textContent();

  await page.goto(`/questionnaire?${QUERY}#result`);
  const url = new URL(page.url());
  expect(url.pathname).toBe(QUESTIONNAIRE);
  expect(url.search).toBe(`?${QUERY}`);
  expect(url.hash).toBe('#result');
  await expect(page.locator('details')).toHaveCount(6);
  expect(await page.getByRole('table').first().textContent()).toBe(expected);
});

test('мова в <html lang>, canonical і hreflang на сторінці країни', async ({ page }) => {
  await page.goto(countryHref('uk', 'sources'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(new URL(canonical ?? '').pathname).toBe('/uk/poland/sources');

  const hreflang = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) => links.map((l) => [l.getAttribute('hreflang'), new URL(l.getAttribute('href') ?? '').pathname]));
  expect(hreflang).toEqual([
    ['uk', '/uk/poland/sources'],
    ['x-default', '/uk/poland/sources'],
  ]);
});

test('невідома мова — 404, технічна /tokens лишається на місці', async ({ request }) => {
  expect((await request.get('/en/poland', { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get('/tokens', { maxRedirects: 0 })).status()).toBe(200);
});
