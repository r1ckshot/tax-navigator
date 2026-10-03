import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { encodeAnswers } from '../app/lib/share';
import { baseAnswers } from '../app/lib/calc/__tests__/fixtures';
import { parseTokens } from '../app/lib/tokens';
import { visibleScreens, type Draft } from '../app/lib/questions/schema';
import { t } from '../app/lib/i18n/uk';

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

/**
 * «— звірено YYYY-MM-DD» під кожним джерелом результату ховається з тієї ж
 * причини, що на `/sources`: бот автозвірки рухає дати щомісяця, і перший його
 * PR (2026-10-02, #124) повалив обидві сцени результату на 69 пікселях дати.
 * Не `mask`, а `visibility: hidden`: маска малюється й для дат у згорнутих
 * картках, яких на екрані немає, і лягла прямокутниками на кнопки внизу.
 * `visibility` лишає місце під текстом, тож верстка не зсувається.
 */
const HIDE_SOURCE_DATES = 'a[target="_blank"] + span[class*="meta"] { visibility: hidden; }';

test('екран результату, картки згорнуті', async ({ page }) => {
  await page.goto(RESULT_URL);

  const cards = page.locator('details');
  // Шість карток означає, що лінк розкодувався і рендериться саме результат:
  // на нерозкодованому лінку сторінка показала б перший екран анкети.
  await expect(cards).toHaveCount(SCENARIO_COUNT);
  await expect(cards.first()).not.toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page);

  await page.addStyleTag({ content: HIDE_SOURCE_DATES });
  await expect(page).toHaveScreenshot('result-collapsed.png', { fullPage: true });
});

test('екран результату, перша картка розкрита', async ({ page }) => {
  await page.goto(RESULT_URL);

  const first = page.locator('details').first();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page);

  await page.addStyleTag({ content: HIDE_SOURCE_DATES });
  await expect(page).toHaveScreenshot('result-expanded.png', { fullPage: true });
});

/**
 * Підстава без права на бізнес: карта на роботу. Профіль — той самий `baseAnswers`,
 * лише з іншою підставою, а `clientCount` знято: питання про замовників
 * показується тільки там, де JDG дозволена, тож у посиланні його бути не може.
 * Друга картка — JDG: у ній видно і причину замість числа, і джерело норми.
 */
const NO_RIGHT_URL = `/questionnaire?${encodeAnswers({ ...baseAnswers, stayBasis: 'work_permit', clientCount: undefined })}`;

test('екран результату, форми без права на бізнес', async ({ page }) => {
  await page.goto(NO_RIGHT_URL);

  const cards = page.locator('details');
  await expect(cards).toHaveCount(SCENARIO_COUNT);
  const jdg = cards.nth(1);
  await jdg.locator('summary').click();
  await expect(jdg).toHaveAttribute('open', '');
  // Число замінила причина, а не зникла картка: варіант лишається в порівнянні.
  await expect(page.getByText(t('status.business.notAllowed')).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.addStyleTag({ content: HIDE_SOURCE_DATES });
  await expect(page).toHaveScreenshot('result-no-right.png', { fullPage: true });
});

test('словник дизайну', async ({ page }) => {
  await page.goto('/tokens');

  // Кількість зразків виводиться з того самого globals.css, що читає сторінка:
  // записане тут число розійшлося б зі словником на першому новому кольорі.
  const dict = parseTokens(readFileSync('app/globals.css', 'utf8'));
  await expect(page.locator('figure')).toHaveCount(dict.palette.length + dict.colorRoles.length);
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('tokens.png', { fullPage: true });
});

/**
 * Єдина сцена, чий вигляд залежить від дати: стан свіжості рахується від
 * `verified_at` до сьогодні. Правило, що стало давнім, змінює еталон — це не шум,
 * а сигнал звірити правила знову; оновлювати еталон після звірки, а не замість неї.
 *
 * Самі дати замасковано (сесія 04 теми 1.2): бот автозвірки щомісяця піднімає
 * `verified_at`, і без маски кожен його PR валив би цей тест, хоча верстка та
 * сама. Рядок `YYYY-MM-DD` завжди однакової ширини, тож маска нічого не ховає з
 * розкладки; позначку свіжості не замасковано — її зміна і є сигналом.
 */
test('джерела цифр', async ({ page }) => {
  await page.goto('/sources');

  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(9);
  await expect(page.getByRole('listitem')).toHaveCount(30);
  await expectNoHorizontalOverflow(page);

  const dates = page.locator('li span[class*="date"]');
  await expect(dates).toHaveCount(30);
  await expect(page).toHaveScreenshot('sources.png', { fullPage: true, mask: [dates] });
});

/**
 * Екран анкети відкривається чернеткою в sessionStorage, а не кліками: сторінка
 * при старті відновлює прогрес (`loadDraft` → `resumeIndex`), тож досить покласти
 * відповіді попередніх екранів і номер кроку. Відповіді беруться з того самого
 * `baseAnswers`, що й результат, тож усі екрани показують один профіль.
 *
 * `answered` вирішує, чи заповнений сам цільовий екран: вибраний стан і
 * активна кнопка «Далі» теж верстка, і без нього їх не знімає жодна сцена.
 */
async function openQuestion(page: Page, id: string, answered: boolean) {
  const draft: Draft = {};
  for (const screen of visibleScreens(baseAnswers)) {
    if (screen.id === id && !answered) break;
    for (const field of screen.fields) (draft as Record<string, unknown>)[field.name] = baseAnswers[field.name];
    if (screen.id === id) break;
  }
  const step = visibleScreens(draft).findIndex((s) => s.id === id);
  expect(step, `екран ${id} не видно для цього профілю`).toBeGreaterThanOrEqual(0);

  await page.addInitScript(
    ([value]) => window.sessionStorage.setItem('tax-navigator:draft', value),
    [JSON.stringify({ answers: draft, step })],
  );
  await page.goto('/questionnaire');

  const screen = visibleScreens(draft)[step];
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t(screen.titleKey));
}

test('анкета, перший крок з вибраною відповіддю', async ({ page }) => {
  await openQuestion(page, 'days', true);

  await expect(page.getByLabel(t('q.days.gte183'))).toBeChecked();
  await expect(page.getByRole('button', { name: t('nav.next') })).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('question-days.png', { fullPage: true });
});

test('анкета, підстава перебування', async ({ page }) => {
  await openQuestion(page, 'status', true);

  await expect(page.getByLabel(t('q.status.ukr'))).toBeChecked();
  await expect(page.getByRole('button', { name: t('nav.next') })).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('question-status.png', { fullPage: true });
});

test('анкета, два питання на одному екрані', async ({ page }) => {
  await openQuestion(page, 'centers', false);

  await expect(page.getByRole('group')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('question-centers.png', { fullPage: true });
});

test('анкета, повзунок виручки', async ({ page }) => {
  await openQuestion(page, 'revenue', true);

  await expect(page.getByRole('slider')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await expect(page).toHaveScreenshot('question-revenue.png', { fullPage: true });
});

