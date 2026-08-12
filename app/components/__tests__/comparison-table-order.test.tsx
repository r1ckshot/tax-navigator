/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionnairePage from '@/questionnaire/page';
import { compareScenarios } from '@/lib/calc/scenarios';
import { baseAnswers } from '@/lib/calc/__tests__/fixtures';
import { t } from '@/lib/i18n/uk';

/**
 * Мінімальний прохід до екрана результату (медіанний профіль, як baseAnswers
 * у app/lib/calc/__tests__/fixtures.ts). Локальний, а не імпорт із
 * flow.test.tsx: там хелпер не експортований, а дублювати invasively в чужий
 * файл ради одного нового тесту не варто.
 */
async function walkToResult() {
  const user = userEvent.setup();
  render(<QuestionnairePage />);

  await user.click(screen.getByLabelText(t('q.days.gte183')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(within(screen.getByRole('group', { name: t('q.centers.personal') })).getByLabelText(t('q.centers.pl')));
  await user.click(within(screen.getByRole('group', { name: t('q.centers.economic') })).getByLabelText(t('q.centers.pl')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(screen.getByLabelText(t('q.special.no')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(screen.getByLabelText(t('q.income.plClients')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(screen.getByLabelText(t('q.uaFop.no')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  fireEvent.change(screen.getByLabelText(t('q.revenue.label')), { target: { value: '15000' } });
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(within(screen.getByRole('group', { name: t('q.work.kind') })).getByLabelText(t('q.work.programming')));
  await user.click(within(screen.getByRole('group', { name: t('q.work.expenses') })).getByLabelText(t('q.work.lt10')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(screen.getByLabelText(t('q.parallelUop.no')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(screen.getByLabelText(t('q.formerEmployer.no')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(screen.getByLabelText(t('q.jdg.gt30')));
  await user.click(screen.getByRole('button', { name: t('nav.showResult') }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/questionnaire');
});

afterEach(cleanup);

/**
 * На відміну від сусіднього тесту в flow.test.tsx (звіряє з хардкодженим
 * масивом id), тут еталон — реальний виклик compareScenarios(baseAnswers):
 * розходження між компонентом і рушієм ловиться, навіть якщо обидва мовчки
 * зміняться в один бік.
 */
describe('ComparisonTable — порядок рядків проти compareScenarios', () => {
  it('рівно 6 рядків, порядок збігається з compareScenarios(baseAnswers)', async () => {
    await walkToResult();

    const region = screen.getByRole('region', { name: t('scenarios.title') });
    const table = within(region).getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // без шапки
    const names = rows.map((row) => within(row).getByRole('rowheader').textContent);

    const expected = compareScenarios(baseAnswers).map((s) => t(`scenario.${s.id}`));

    expect(rows.length).toBe(6);
    expect(names).toEqual(expected);
  });
});
