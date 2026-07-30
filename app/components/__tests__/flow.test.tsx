/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionnairePage from '@/questionnaire/page';
import { t } from '@/lib/i18n/uk';

/**
 * Проходить анкету так, як це робить людина: клікає варіанти й тисне «Далі».
 * Замінює ручний прогін у браузері (next build/dev у цьому середовищі не
 * стартують), тому перевіряє саме те, що описано у верифікації плану.
 */
async function answerAndAdvance(user: ReturnType<typeof userEvent.setup>, labels: string[]) {
  for (const label of labels) {
    await user.click(screen.getByLabelText(label));
  }
  const next = screen.queryByRole('button', { name: t('nav.next') });
  await user.click(next ?? screen.getByRole('button', { name: t('nav.showResult') }));
}

/** Медіанний шлях: резидент PL, повний ZUS, програмування, 15,000 zł. */
async function walkMedianPath(revenue = '15000') {
  const user = userEvent.setup();
  render(<QuestionnairePage />);

  await answerAndAdvance(user, [t('q.days.gte183')]);

  // Екран «центри» має два поля — обираємо в кожному окремо.
  await user.click(within(screen.getByRole('group', { name: t('q.centers.personal') })).getByLabelText(t('q.centers.pl')));
  await user.click(within(screen.getByRole('group', { name: t('q.centers.economic') })).getByLabelText(t('q.centers.pl')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await answerAndAdvance(user, [t('q.special.no')]);

  // Джерело доходу — окремий екран; житло в UA не питається (обидва центри в PL).
  await answerAndAdvance(user, [t('q.income.plClients')]);

  await answerAndAdvance(user, [t('q.uaFop.no')]);

  // Виручка — слайдер: задаємо значення напряму (квантизується до кроку 2500).
  fireEvent.change(screen.getByLabelText(t('q.revenue.label')), { target: { value: revenue } });
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await user.click(within(screen.getByRole('group', { name: t('q.work.kind') })).getByLabelText(t('q.work.programming')));
  await user.click(within(screen.getByRole('group', { name: t('q.work.expenses') })).getByLabelText(t('q.work.lt10')));
  await user.click(screen.getByRole('button', { name: t('nav.next') }));

  await answerAndAdvance(user, [t('q.parallelUop.no')]);
  await answerAndAdvance(user, [t('q.formerEmployer.no')]);
  await answerAndAdvance(user, [t('q.jdg.gt30')]);

  return user;
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/questionnaire');
});

afterEach(cleanup);

describe('анкета — наскрізний прохід', () => {
  it('десять кроків доводять до результату з вердиктом і чотирма варіантами', async () => {
    await walkMedianPath();

    expect(screen.getByText(t('residency.plResident'))).toBeDefined();
    for (const id of ['fop', 'jdg', 'incubator', 'uop']) {
      expect(screen.getAllByText(t(`scenario.${id}`)).length).toBeGreaterThan(0);
    }
  });

  it('дисклеймер присутній на екрані результату', async () => {
    await walkMedianPath();
    // Текст містить \n (кожне речення з нового рядка), тож матчимо за фрагментом.
    expect(screen.getByText(/Це інформаційний калькулятор орієнтовного характеру/)).toBeDefined();
  });

  it('ФОП: злотова колонка без числа з поясненням чому', async () => {
    await walkMedianPath();
    // Саме уточнений напис, а не загальне «Без числового діапазону»: у картці
    // числа Є, тож порожня має читатись як «польське на руки», а не «взагалі».
    expect(screen.getAllByText(t('fop.noPlTakeHome')).length).toBeGreaterThan(0);
    expect(screen.getByText(t('fop.plSideNotVerified'))).toBeDefined();
  });

  // Валюта мусить бути підписана: та сама картка показує обидві, і сплутати їх
  // означало б показати гривню під злотовим заголовком.
  it('ФОП: український тягар видно двома підписаними валютами', async () => {
    await walkMedianPath();
    expect(screen.getByText(t('fop.burden.label'))).toBeDefined();
    expect(screen.getByText(t('fop.burden.esv'))).toBeDefined();
    expect(screen.getAllByText(t('unit.uahMonth')).length).toBeGreaterThan(0);
  });

  it('на картці JDG видно підформи і примітку про IP Box', async () => {
    await walkMedianPath();
    expect(screen.getByText(t('subform.ryczalt'))).toBeDefined();
    expect(screen.getByText(t('subform.liniowy'))).toBeDefined();
    expect(screen.getByText(t('jdg.ipBoxNotIncluded'))).toBeDefined();
  });

  it('UoP пояснює базу порівняння, інакше воно лестило б B2B', async () => {
    await walkMedianPath();
    expect(screen.getByText(t('uop.employerCostBasis'))).toBeDefined();
  });
});

describe('порівняльна таблиця', () => {
  it('показує всі чотири варіанти в одній таблиці з колонкою «на руки»', async () => {
    await walkMedianPath();

    // Секція порівняння (окремо від таблиць-підформ усередині акордеонів).
    const region = screen.getByRole('region', { name: t('scenarios.title') });
    const table = within(region).getByRole('table');
    expect(within(table).getByText(t('chart.col.range'))).toBeDefined();
    expect(within(table).getByText(t('chart.col.risk'))).toBeDefined();
    expect(within(table).getAllByRole('row').length).toBe(5); // шапка + 4 варіанти
  });
});

describe('приватність і прогрес', () => {
  it('точна виручка не потрапляє в sessionStorage', async () => {
    await walkMedianPath('17342');
    expect(window.sessionStorage.getItem('tax-navigator:draft') ?? '').not.toContain('17342');
  });

  it('прогрес зберігається між кроками; точна сума в сховище не потрапляє', async () => {
    const user = userEvent.setup();
    render(<QuestionnairePage />);
    await user.click(screen.getByLabelText(t('q.days.gte183')));
    await user.click(screen.getByRole('button', { name: t('nav.next') }));

    const saved = window.sessionStorage.getItem('tax-navigator:draft') ?? '';
    expect(saved).toContain('gte183');
    // Виручка ще не обрана; коли буде — тільки крок 2500, ніколи точна сума.
    expect(saved).not.toContain('17342');
  });
});
