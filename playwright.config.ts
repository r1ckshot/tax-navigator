import { defineConfig, devices } from '@playwright/test';

/**
 * Візуальна регресія екрана результату.
 *
 * Цей конфіг свідомо не розрахований на прогін у девконтейнері. Живого браузера
 * тут немає і не буде: `cdn.playwright.dev` флапає на рівні edge-балансувальника
 * (третій anycast-кейс у `.claude/rules/environment-limits.md`), і Rebuild без
 * кешу цього не виправив. Єдиний доступний канал до браузера — GitHub-раннер,
 * тому еталони народжуються там, а не на цій машині.
 *
 * Порт береться з `PORT`, який виставляє `scripts/worktree-ports.mjs` (урок 9.2):
 * два worktree, запущені паралельно, інакше зіткнулися б на 3000. На CI checkout
 * завжди головний worktree, тобто рівно 3000.
 */

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Матриця з `docs/BACKLOG.md`: вузький і широкий вʼюпорт, світла й темна тема.
 * Тема задається емуляцією `prefers-color-scheme`, бо саме на цьому медіазапиті
 * тримається темний токен-набір у `app/globals.css` — окремого перемикача в
 * продукті немає.
 */
const MATRIX = [
  { name: 'mobile-light', viewport: { width: 375, height: 812 }, colorScheme: 'light' },
  { name: 'mobile-dark', viewport: { width: 375, height: 812 }, colorScheme: 'dark' },
  { name: 'desktop-light', viewport: { width: 1280, height: 900 }, colorScheme: 'light' },
  { name: 'desktop-dark', viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
] as const;

export default defineConfig({
  testDir: './visual',

  // Еталон лежить поруч зі своїм проєктом матриці, а не в теці на імʼя ОС:
  // еталони цього репо народжуються рівно на одному образі раннера, тож
  // платформа в шляху була б порожньою обіцянкою переносимості.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',

  // Один воркер і жодного ретраю: скріншот, який проходить з другої спроби, —
  // це не зелений тест, а прихована нестабільність. Хай падає гучно.
  workers: 1,
  retries: 0,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    // Дефолтна локаль раннера не українська, а продукт форматує числа під
    // `uk`; без цього еталони залежали б від налаштувань машини.
    locale: 'uk-UA',
    timezoneId: 'Europe/Warsaw',
  },

  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      // Нуль допуску на кількість пікселів: продукт не має ні анімацій, ні
      // дат, ні випадкових значень у рендері, тож будь-яка різниця означає
      // реальну зміну верстки, а не шум.
      maxDiffPixels: 0,
    },
  },

  projects: MATRIX.map(({ name, viewport, colorScheme }) => ({
    name,
    use: { ...devices['Desktop Chrome'], viewport, colorScheme },
  })),

  webServer: {
    // Саме `start`, а не `build && start`. `next build` у контейнері Mike
    // заборонений (`environment-limits.md`: build і dev ділили `.next`), і
    // конфіг не має права запустити його випадково. Збірку робить окремий крок
    // workflow, там, де вона безпечна.
    command: 'npm run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
