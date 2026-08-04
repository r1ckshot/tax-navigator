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
  it('десять кроків доводять до результату з вердиктом і шістьма варіантами', async () => {
    await walkMedianPath();

    expect(screen.getByText(t('residency.plResident'))).toBeDefined();
    for (const id of ['fop', 'jdg', 'incubator', 'nierejestrowana', 'zlecenie', 'uop']) {
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

  // Пояснення бази стоїть на обох картках найму (UoP і zlecenie) — там воно і
  // потрібне, бо саме там виручка ділиться на нарахування роботодавця.
  it('картки найму пояснюють базу порівняння, інакше воно лестило б B2B', async () => {
    await walkMedianPath();
    expect(screen.getAllByText(t('uop.employerCostBasis')).length).toBe(2);
  });

  // Питання про хворобову анкета ставить лише в контексті пільгового ZUS для JDG
  // (`showIf` у schema.ts), тож на медіанному шляху воно не звучить і в zleceniu
  // складка не врахована. Примітка мусить це сказати, НЕ приписуючи людині вибору,
  // якого вона не робила.
  it('zlecenie: підформи KUP і чесна примітка про невраховану хворобову', async () => {
    await walkMedianPath();
    expect(screen.getAllByText(t('subform.kup20')).length).toBeGreaterThan(0);
    expect(screen.getByText(t('zlecenie.choroboweSkipped'))).toBeDefined();
    expect(screen.getByText(t('zlecenie.studentUnder26'))).toBeDefined();
  });

  // Медіанний шлях відповідає «JDG понад 30 місяців», тож умова 60 місяців не
  // виконана — і сценарій показує ПРИЧИНУ замість числа. Це його штатний вигляд
  // для більшості людей, а не крайній випадок, тому й перевіряється тут.
  it('nierejestrowana: замість числа названо причину, і пастка про ZUS видна', async () => {
    await walkMedianPath();
    expect(screen.getAllByText(t('nierejestrowana.priorBusiness')).length).toBeGreaterThan(0);
    expect(screen.getByText(t('nierejestrowana.zusOnServices'))).toBeDefined();
    expect(screen.getByText(t('nierejestrowana.lookback60'))).toBeDefined();
  });
});

describe('порівняльна таблиця', () => {
  // Підпис колонки продубльований у кожному рядку (у стековому режимі шапки не
  // видно), тому шапка шукається саме за роллю, а не за текстом: дублі —
  // `aria-hidden`, у дерево доступності не потрапляють.
  it('показує всі шість варіантів в одній таблиці з колонкою «на руки»', async () => {
    await walkMedianPath();

    // Секція порівняння (окремо від таблиць-підформ усередині акордеонів).
    const region = screen.getByRole('region', { name: t('scenarios.title') });
    const table = within(region).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: t('chart.col.range') })).toBeDefined();
    expect(within(table).getByRole('columnheader', { name: t('chart.col.risk') })).toBeDefined();
    expect(within(table).getAllByRole('row').length).toBe(7); // шапка + 6 варіантів
  });

  // Рішення 2026-08-04: усі шість рівноважні, порядок фіксований для будь-якого
  // профілю. Тест ловить саме те, що не переживе мовчазного рефактора — спробу
  // винести варіанти без числа вниз або в окремий блок «не для тебе».
  it('порядок рядків фіксований і не залежить від того, у кого є число', async () => {
    await walkMedianPath();

    const region = screen.getByRole('region', { name: t('scenarios.title') });
    const rows = within(region).getAllByRole('row').slice(1); // без шапки
    const names = rows.map((row) => within(row).getByRole('rowheader').textContent);

    expect(names).toEqual(
      ['fop', 'jdg', 'incubator', 'nierejestrowana', 'zlecenie', 'uop'].map((id) =>
        t(`scenario.${id}`)
      )
    );
  });

  // Для медіанного профілю ФОП і nierejestrowana числа не дають. Клітинка мусить
  // нести причину І бути позначеною `data-empty` — на цій позначці тримається вся
  // відмінність у типографіці, і без неї причина виглядала б як сума.
  it('рядок без числа несе причину і позначку, за якою його відрізняє верстка', async () => {
    await walkMedianPath();

    const region = screen.getByRole('region', { name: t('scenarios.title') });
    const rows = within(region).getAllByRole('row').slice(1);
    // Перша клітинка рядка — сума або причина; друга — ризик.
    const valueCell = (row: HTMLElement) => within(row).getAllByRole('cell')[0];
    const empty = rows.filter((row) => valueCell(row).dataset.empty === 'true');

    expect(empty.length).toBe(2);
    for (const row of empty) {
      expect(valueCell(row).textContent).not.toBe('');
    }
  });
});

describe('іконка ризику без видимого підпису', () => {
  /*
   * Правило `product-safety.md` §Статус-іконки: у картках «Деталей» іконка
   * стоїть без видимого підпису, але сам підпис МУСИТЬ лишатись у розмітці —
   * інакше рівень ризику зникає для читалки й для пошуку по сторінці. Тест
   * падає рівно тоді, коли хтось «оптимізує» приховування на `display: none`
   * або викине текст із компонента.
   */
  it('підпис рівня лишається в розмітці, хоч його й не видно', async () => {
    await walkMedianPath();

    const cards = Array.from(document.querySelectorAll('details'));
    expect(cards.length).toBe(6);

    const levels = ['green', 'yellow', 'red'].map((l) => t(`risk.${l}`));
    for (const card of cards) {
      const summary = card.querySelector('summary');
      // Саме textContent, а не пошук за роллю чи `title`: атрибут пережив би
      // видалення тексту, і перевірка стала б беззубою (спіймано мутацією).
      expect(levels.some((label) => summary?.textContent?.includes(label))).toBe(true);
    }
  });
});

describe('український тягар ФОП', () => {
  // Підпис звʼязаний із таблицею через aria-labelledby: він і є доступною назвою.
  // Якщо звʼязок розірветься при рефакторі, читалка перестане казати, що ці суми
  // з ЧУЖОЇ юрисдикції — рівно та помилка комунікації, через яку 2 850 zł
  // прочитались як «на руки» (DECISIONS 2026-08-03).
  it('таблиця тягаря має доступну назву, яка називає це витратами', async () => {
    await walkMedianPath();

    const burden = screen.getByRole('table', { name: t('fop.burden.label') });
    expect(within(burden).getByText(t('fop.burden.esv'))).toBeDefined();
    // Підпис мусить називати дію («платиш») і бік («український»): саме цих двох
    // слів бракувало, коли 2 850 zł прочитались як дохід.
    expect(t('fop.burden.label')).toMatch(/платиш/);
    expect(t('fop.burden.label')).toMatch(/[Уу]країнськ/);
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
