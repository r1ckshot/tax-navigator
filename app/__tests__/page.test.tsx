/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/page';
import { compareScenarios } from '@/lib/calc/scenarios';
import { baseAnswers } from '@/lib/calc/__tests__/fixtures';
import { t } from '@/lib/i18n/uk';

/**
 * `app/page.tsx` тримає власний хардкоджений список `SCENARIOS` (коментар
 * обіцяє «ті самі шість сценаріїв і в тому ж порядку, що й у таблиці
 * результату»), але код нічим не гарантує цю обіцянку — список і
 * `compareScenarios` можуть розійтись мовчки при рефакторі. Цей тест ловить
 * саме розходження, а не сам факт наявності шести пунктів.
 */
describe('лендинг — список сценаріїв', () => {
  it('порядок і кількість пунктів списку збігаються з compareScenarios', () => {
    render(<Home />);

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    const expected = compareScenarios(baseAnswers).map((s) => t(`scenario.${s.id}`));

    expect(items).toEqual(expected);
  });
});
