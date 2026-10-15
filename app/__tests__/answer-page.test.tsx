/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import AnswerPage, { generateMetadata, generateStaticParams } from '@/[locale]/poland/[slug]/page';
import { RULES } from '@/lib/rules/types';
import { plain, q, t } from '@/lib/__tests__/plain';

afterEach(cleanup);

const params = (slug: string) => Promise.resolve({ locale: 'uk', slug });

describe('шаблон сторінки-відповіді: демо ryczalt-it', () => {
  it('статичні адреси — рівно сторінки з реєстру', () => {
    expect(generateStaticParams()).toEqual(
      [
        'jdg-ukr-cukr', 'rezydentstvo-bank-broker', 'vat-jdg', 'pip-b2b', 'pilgovyi-zus', 'fop-chy-jdg', 'b2b-na-ruky', 'ryczalt-it',
        'b2b-10000-zl', 'b2b-15000-zl', 'b2b-20000-zl', 'b2b-25000-zl', 'b2b-30000-zl', 'b2b-40000-zl',
      ].map((slug) => ({ locale: 'uk', slug })),
    );
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

  it('кнопка веде в анкету з передзаповненням; дисклеймер сторінки, не калькулятора; гайду ще немає', async () => {
    render(await AnswerPage({ params: params('ryczalt-it') }));
    expect(screen.getByRole('link', { name: t('app.start') }).getAttribute('href')).toBe(
      '/uk/poland/questionnaire?w=programming&start=1',
    );
    expect(screen.getByText(q('answer.cta.text'))).toBeDefined();
    // Рев'ю сесії 13, P2-2: сторінка не калькулятор.
    expect(screen.getByText(/Це довідкова сторінка, а не податкова консультація/)).toBeDefined();
    expect(screen.queryByText(/калькулятор/i)).toBeNull();
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

describe('сторінка без передзаповнення: jdg-ukr-cukr', () => {
  it('кнопка — звичайна анкета, текст біля неї не обіцяє вибраних відповідей', async () => {
    render(await AnswerPage({ params: params('jdg-ukr-cukr') }));
    expect(screen.getByRole('link', { name: t('app.start') }).getAttribute('href')).toBe('/uk/poland/questionnaire');
    expect(screen.getByText(q('answer.cta.textBlank'))).toBeDefined();
    expect(screen.queryByText(q('answer.cta.text'))).toBeNull();
  });

  it('дата з правила на сторінці, без сирих плейсхолдерів', async () => {
    render(await AnswerPage({ params: params('jdg-ukr-cukr') }));
    const text = plain(document.body.textContent ?? '');
    expect(text).toContain('продовжено до 04.03.2028');
    expect(text).not.toMatch(/\{\{|\}\}/);
  });
});

describe('сторінка з движка: b2b-15000-zl', () => {
  it('заголовок, припущення, таблиця діапазонів з підписаними рядками', async () => {
    render(await AnswerPage({ params: params('b2b-15000-zl') }));
    expect(plain(screen.getByRole('heading', { level: 1 }).textContent ?? '')).toBe('B2B у Польщі: 15 000 zł на місяць — скільки лишається');
    const table = screen.getByRole('table', { name: /Орієнтовна\s+сума/ });
    const rows = within(table).getAllByRole('row').slice(1);
    // Еталони виведено вручну: engine-page.test.ts, ричалт і шкала на 15 000 zł.
    expect(rows.map((r) => plain(r.textContent ?? ''))).toEqual([
      'JDG, ричалт9 353 – 10 132',
      'JDG, лінійний податок9 113 – 9 872',
      'JDG, шкала9 188 – 9 954',
      'Трудовий договір, для порівняння8 370 – 9 067',
    ]);
    expect(within(table).getAllByRole('columnheader').map((h) => plain(h.textContent ?? ''))).toEqual(['Форма', 'Діапазон, zł на місяць']);
  });

  it('кнопка веде в анкету з профілем і сумою; дисклеймер сторінки; перелінковка', async () => {
    render(await AnswerPage({ params: params('b2b-15000-zl') }));
    const href = screen.getByRole('link', { name: t('app.start') }).getAttribute('href')!;
    expect(href.startsWith('/uk/poland/questionnaire?')).toBe(true);
    expect(href).toContain('r=15000');
    expect(href).toContain('start=1');
    expect(screen.getByText(/Це довідкова сторінка, а не податкова консультація/)).toBeDefined();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/uk/poland/b2b-na-ruky');
    expect(hrefs).toContain('/uk/poland/b2b-20000-zl');
    expect(hrefs).not.toContain('/uk/poland/b2b-15000-zl');
  });

  it('метадані: заголовок із сумою, canonical і hreflang', async () => {
    const meta = await generateMetadata({ params: params('b2b-15000-zl') });
    expect(plain(String(meta.title))).toContain('15 000 zł');
    expect(meta.alternates).toEqual({
      canonical: '/uk/poland/b2b-15000-zl',
      languages: { uk: '/uk/poland/b2b-15000-zl', 'x-default': '/uk/poland/b2b-15000-zl' },
    });
  });

  it('суми, якої немає в наборі, — 404, а не порожній шаблон', async () => {
    await expect(AnswerPage({ params: params('b2b-15001-zl') })).rejects.toThrow();
  });
});

describe('перелінковка на сторінці-відповіді', () => {
  it('блок «Дивіться також» — посилання, не URL у тексті', async () => {
    render(await AnswerPage({ params: params('b2b-na-ruky') }));
    const link = screen.getByRole('link', { name: /Приклад:\s+скільки\s+лишається/ });
    expect(link.getAttribute('href')).toBe('/uk/poland/b2b-20000-zl');
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
    // Три холодні динамічні імпорти сторінок: у девконтейнері (9p) це ~5–6 с,
    // тобто впритул до дефолтних 5 с, а на CI — частки секунди.
  }, 30_000);

  it('/tokens закрита від пошуку', async () => {
    const { metadata } = await import('@/(technical)/tokens/page');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

