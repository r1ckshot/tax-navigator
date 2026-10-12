/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Home from '@/[locale]/poland/page';
import { compareScenarios } from '@/lib/calc/scenarios';
import { baseAnswers } from '@/lib/calc/__tests__/fixtures';
import { q, t } from '@/lib/__tests__/plain';

// Без cleanup дерево попереднього render лишається в документі, і однакових
// лінків стає два.
afterEach(cleanup);

/** Сторінка серверна й асинхронна: мова приходить з адреси промісом (Next 15). */
const renderHome = async () => render(await Home({ params: Promise.resolve({ locale: 'uk' }) }));

/**
 * `app/[locale]/poland/page.tsx` тримає власний хардкоджений список `SCENARIOS` (коментар
 * обіцяє «ті самі шість сценаріїв і в тому ж порядку, що й у таблиці
 * результату»), але код нічим не гарантує цю обіцянку — список і
 * `compareScenarios` можуть розійтись мовчки при рефакторі. Цей тест ловить
 * саме розходження, а не сам факт наявності шести пунктів.
 */
describe('лендинг — список сценаріїв', () => {
  it('порядок і кількість пунктів списку збігаються з compareScenarios', async () => {
    await renderHome();

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    const expected = compareScenarios(baseAnswers).map((s) => t(`scenario.${s.id}`));

    expect(items).toEqual(expected);
  });
});

describe('лендинг — рядок про джерела', () => {
  // Повний список джерел — у шапці («Джерела», SiteHeader); на лендінгу лише
  // твердження про них, без другого лінку на ту саму сторінку.
  it('під кнопкою анкети рядок про джерела, кнопка лишилась', async () => {
    await renderHome();

    expect(screen.queryByRole('link', { name: t('sources.link') })).toBeNull();
    expect(screen.getByText(q('app.trust'))).toBeDefined();
    // Дія — сам лінк, без <button> усередині: кнопка в посиланні — інтерактивний
    // елемент в інтерактивному, невалідний HTML.
    expect(screen.getByRole('link', { name: t('app.start') }).getAttribute('href')).toBe('/uk/poland/questionnaire');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
