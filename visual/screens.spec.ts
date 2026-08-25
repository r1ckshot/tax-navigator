import { expect, test, type Page } from '@playwright/test';
import { encodeAnswers } from '../app/lib/share';
import { baseAnswers } from '../app/lib/calc/__tests__/fixtures';

/**
 * Екран результату досягається шеринг-лінком, а не клікам по анкеті: анкета —
 * це десять екранів вводу, і кожен її крок додав би до візуального тесту
 * причину впасти, не маючи стосунку до верстки результату.
 *
 * Профіль не виписаний рядком, а зібраний тим самим `encodeAnswers` з того
 * самого `baseAnswers`, що й еталони двигуна. Дві копії одного профілю
 * розійшлися б мовчки, і еталонні скріншоти показували б інші числа, ніж
 * перевіряють node-тести.
 */
const RESULT_URL = `/questionnaire?${encodeAnswers(baseAnswers)}`;

/** Шість сценаріїв порівняння — стільки ж карток «Деталей» на екрані. */
const SCENARIO_COUNT = 6;

/**
 * Горизонтальний скрол — окреме ствердження, а не робота діффа пікселів.
 * `fullPage`-скріншот сторінки, що поїхала вбік, просто виходить ширшим за
 * вʼюпорт, і різниця читається як «щось змінилось», не називаючи що саме.
 *
 * Перевірка не теоретична: перший же прогін цього набору дав 384px при вʼюпорті
 * 375 — підпис «Чистими, zł/міс» не влазив у пару з найширшим числом і виносив
 * сторінку за екран.
 */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'сторінка їде горизонтально').toBe(0);
}

test('лендинг', async ({ page }) => {
  await page.goto('/');

  // Структурна перевірка перед скріншотом навмисно: якщо сторінка взагалі не
  // та, тест має сказати це словами, а не діффом пікселів.
  await expect(page.getByRole('listitem')).toHaveCount(SCENARIO_COUNT);
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('landing.png', { fullPage: true });
});

test('екран результату, картки згорнуті', async ({ page }) => {
  await page.goto(RESULT_URL);

  const cards = page.locator('details');
  // Шість карток означає, що лінк розкодувався і рендериться саме результат:
  // на нерозкодованому лінку сторінка показала б перший екран анкети.
  await expect(cards).toHaveCount(SCENARIO_COUNT);
  await expect(cards.first()).not.toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('result-collapsed.png', { fullPage: true });
});

test('екран результату, перша картка розкрита', async ({ page }) => {
  await page.goto(RESULT_URL);

  const first = page.locator('details').first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('result-expanded.png', { fullPage: true });
});
