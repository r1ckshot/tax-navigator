import { expect, test } from '@playwright/test';
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

test('лендинг', async ({ page }) => {
  await page.goto('/');

  // Структурна перевірка перед скріншотом навмисно: якщо сторінка взагалі не
  // та, тест має сказати це словами, а не діффом пікселів.
  await expect(page.getByRole('listitem')).toHaveCount(SCENARIO_COUNT);

  await expect(page).toHaveScreenshot('landing.png', { fullPage: true });
});

test('екран результату, картки згорнуті', async ({ page }) => {
  await page.goto(RESULT_URL);

  const cards = page.locator('details');
  // Шість карток означає, що лінк розкодувався і рендериться саме результат:
  // на нерозкодованому лінку сторінка показала б перший екран анкети.
  await expect(cards).toHaveCount(SCENARIO_COUNT);
  await expect(cards.first()).not.toHaveAttribute('open', '');

  await expect(page).toHaveScreenshot('result-collapsed.png', { fullPage: true });
});

test('екран результату, перша картка розкрита', async ({ page }) => {
  await page.goto(RESULT_URL);

  const first = page.locator('details').first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');

  await expect(page).toHaveScreenshot('result-expanded.png', { fullPage: true });
});
