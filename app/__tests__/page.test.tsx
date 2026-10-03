/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Home from '@/[locale]/poland/page';
import { compareScenarios } from '@/lib/calc/scenarios';
import { baseAnswers } from '@/lib/calc/__tests__/fixtures';
import { t } from '@/lib/i18n/uk';

// Без cleanup дерево попереднього render лишається в документі, і однакових
// лінків стає два.
afterEach(cleanup);

/** Сторінка серверна й асинхронна: мова приходить з адреси промісом (Next 15). */
const renderHome = async () => render(await Home({ params: Promise.resolve({ locale: 'uk' }) }));

/**
 * `app/page.tsx` тримає власний хардкоджений список `SCENARIOS` (коментар
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
  it('під кнопкою анкети лінк на повний список джерел, кнопка лишилась', async () => {
    await renderHome();

    expect(screen.getByRole('link', { name: t('sources.link') }).getAttribute('href')).toBe('/uk/poland/sources');
    expect(screen.getByText(t('app.trust'))).toBeDefined();
    expect(screen.getByRole('button', { name: t('app.start') }).closest('a')?.getAttribute('href')).toBe('/uk/poland/questionnaire');
  });
});
