/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BrandHome from '@/[locale]/page';
import { SiteHeader } from '@/components/SiteHeader';
import { compareScenarios } from '@/lib/calc/scenarios';
import { baseAnswers } from '@/lib/calc/__tests__/fixtures';
import { q, t } from '@/lib/__tests__/plain';
import { SCREENS } from '@/lib/questions/schema';
import { WAITLIST_URL } from '@/lib/waitlist';

afterEach(cleanup);

const renderBrand = async () => render(await BrandHome({ params: Promise.resolve({ locale: 'uk' }) }));

describe('лендінг бренду /', () => {
  it('два входи: Польща веде на сторінку країни, порівняння країн — «скоро» з листом очікування', async () => {
    await renderBrand();

    const live = screen.getByRole('heading', { name: t('brand.live.title') });
    expect(live.closest('a')?.getAttribute('href')).toBe('/uk/poland');

    const compare = screen.getByRole('heading', { name: t('brand.compare.title') });
    // Вхід «скоро» — картка-посилання на форму очікування, а не на сторінку
    // продукту; «скоро» сказано словами в запрошенні, а не бейджем.
    const card = compare.closest('a')!;
    expect(card.getAttribute('href')).toBe(WAITLIST_URL);
    expect(card.textContent).toContain(t('brand.compare.invite'));
    expect(t('brand.compare.invite')).toMatch(/скоро/);
  });

  it('кнопки — лише вигляд: посилання в посиланні немає', async () => {
    const { container } = await renderBrand();
    expect(container.querySelectorAll('a a')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Число варіантів у тексті вхідних сторінок — прозою, тож розійтися з
  // двигуном воно може мовчки: додали сценарій, а «шість» лишилось.
  it('«шість варіантів» у текстах лендінгів = кількість сценаріїв двигуна', () => {
    expect(compareScenarios(baseAnswers)).toHaveLength(6);
    expect(q('brand.live.body')).toMatch(/шість варіантів/i);
    expect(q('app.intro')).toMatch(/шістьма варіантами/);
  });

  it('«до чотирнадцяти питань» = усі екрани анкети, умовні включно', () => {
    expect(SCREENS).toHaveLength(14);
    expect(q('app.intro')).toMatch(/До чотирнадцяти коротких кроків/);
  });

  it('лист очікування — та сама форма, без query: дані анкети туди не йдуть', async () => {
    await renderBrand();

    const waitlist = screen.getByRole('heading', { name: t('brand.compare.title') }).closest('a')!;
    expect(waitlist.getAttribute('href')).toBe(WAITLIST_URL);
    expect(waitlist.getAttribute('href')).not.toMatch(/[?#]/);
    expect(waitlist.getAttribute('target')).toBe('_blank');
    expect(waitlist.getAttribute('rel')).toContain('noopener');
    expect(waitlist.textContent).toContain(t('cta.action'));
  });

});

describe('шапка', () => {
  // Єдиний шлях до повного списку джерел з будь-якої сторінки: лендінг і
  // результат свого лінку на нього більше не мають.
  it('знак веде на головну, «Джерела» — на список джерел Польщі', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: t('brand.home') }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: t('app.sources') }).getAttribute('href')).toBe('/uk/poland/sources');
  });
});
