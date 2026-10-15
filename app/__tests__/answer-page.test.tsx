/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import AnswerPage, { generateMetadata, generateStaticParams } from '@/[locale]/poland/[slug]/page';
import { RULES } from '@/lib/rules/types';
import { plain, t } from '@/lib/__tests__/plain';

afterEach(cleanup);

const params = (slug: string) => Promise.resolve({ locale: 'uk', slug });

describe('шаблон сторінки-відповіді: демо ryczalt-it', () => {
  it('статичні адреси — рівно сторінки з реєстру', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'uk', slug: 'ryczalt-it' }]);
  });

  it('заголовок, числа з правил, без сирих плейсхолдерів', async () => {
    render(await AnswerPage({ params: params('ryczalt-it') }));
    expect(plain(screen.getByRole('heading', { level: 1 }).textContent ?? '')).toBe('Ричалт 12% для програміста на JDG');
    const text = plain(document.body.textContent ?? '');
    expect(text).toContain('ставка 12%.');
    expect(text).not.toMatch(/\{\{|rule_id/);
  });

  it('джерела підписані назвою й датою звірки, rule_id не видно', async () => {
    render(await AnswerPage({ params: params('ryczalt-it') }));
    const block = screen.getByRole('region', { name: t('answer.sources.title') });
    const links = within(block).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual([
      'Stawki i limity',
      'Ustawa o zryczałtowanym podatku dochodowym od niektórych przychodów osiąganych przez osoby fizyczne',
      'Główny Urząd Statystyczny',
      'Nowe wysokości składek na ubezpieczenia społeczne w 2026 r.',
    ]);
    expect(links[0].getAttribute('href')).toBe('https://www.podatki.gov.pl/podatki-firmowe/pit/stawki-i-limity');
    for (const rule of RULES.rules) expect(block.textContent).not.toContain(rule.rule_id);
    expect(block.textContent).toMatch(/звірено \d{2}\.\d{2}\.\d{4}/);
  });

  it('кнопка веде в анкету з передзаповненням; дисклеймер на місці; гайду ще немає', async () => {
    render(await AnswerPage({ params: params('ryczalt-it') }));
    expect(screen.getByRole('link', { name: t('app.start') }).getAttribute('href')).toBe(
      '/uk/poland/questionnaire?w=programming&start=1',
    );
    expect(screen.getByText(/Це інформаційний калькулятор/)).toBeDefined();
    expect(screen.queryByText(/гайд/i)).toBeNull();
  });

  it('метадані: заголовок і опис сторінки, canonical і hreflang', async () => {
    const meta = await generateMetadata({ params: params('ryczalt-it') });
    expect(plain(String(meta.title))).toBe('Ричалт 12% для програміста на JDG');
    expect(plain(meta.description ?? '')).toContain('Скільки податку на ричалті (ryczałt) у програміста');
    expect(meta.alternates).toEqual({
      canonical: '/uk/poland/ryczalt-it',
      languages: { uk: '/uk/poland/ryczalt-it', 'x-default': '/uk/poland/ryczalt-it' },
    });
  });
});

describe('головна: вкладка — лише назва бренду', () => {
  it('<title> — «nettomap», прев\'ю лінка лишається з описом', async () => {
    const { generateMetadata: brandMetadata } = await import('@/[locale]/page');
    const meta = await brandMetadata({ params: Promise.resolve({ locale: 'uk' }) });
    expect(meta.title).toBe(t('app.title'));
    expect(meta.openGraph?.title).toBe(t('brand.title'));
  });
});

describe('метадані сторінок країни', () => {
  it('кожна сторінка має власний заголовок вкладки', async () => {
    const p = Promise.resolve({ locale: 'uk' });
    const titles = await Promise.all([
      import('@/[locale]/poland/page').then((m) => m.generateMetadata({ params: p })),
      import('@/[locale]/poland/questionnaire/page').then((m) => m.generateMetadata({ params: p })),
      import('@/[locale]/poland/sources/page').then((m) => m.generateMetadata({ params: p })),
    ]).then((metas) => metas.map((m) => m.title));
    // Без «· nettomap»: назву сайту пошук показує окремим рядком.
    expect(titles).toEqual([t('poland.title'), t('questionnaire.title'), t('sources.title')]);
    for (const title of titles) expect(String(title)).not.toContain('·');
    expect(new Set(titles).size).toBe(3);
  });

  it('/tokens закрита від пошуку', async () => {
    const { metadata } = await import('@/(technical)/tokens/page');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

