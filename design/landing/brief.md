# Design brief

Screen: Лендинг `/`, блок hero.

Current URL: http://localhost:3000/ (прод: https://tax-navigator-red.vercel.app/)

Goal: людина ще до анкети бачить, що кожна цифра має джерело, і може відкрити
повний список джерел.

Keep:

- Кнопка «Пройти анкету» веде на `/questionnaire`.
- Шість варіантів у тому ж порядку, що в таблиці результату (тримає
  `app/__tests__/page.test.tsx`).
- Hero лишається центрованим; кольори лише з ролей `app/globals.css`.
- Текст українською, без порад.

States:

- default
- loading: N/A, сторінка статична
- success: N/A
- error: N/A
- disabled: N/A, кнопка і лінк завжди активні

Layouts:

- desktop: 1440px
- mobile: 390px

Design references:

- current screenshot: `visual/__screenshots__/{desktop,mobile}-light/landing.png`
- desktop frame: `design/sources.pen#uCOTE` (Landing 1440 — new), поточний UI `#HdjOc`
- mobile frame: `design/sources.pen#otfQs` (Landing 390 — new), поточний UI `#TGEIR`
- exports: `design/canvas/export/landing-{desktop,mobile}.png`
- Pencil source: `design/sources.pen` (той самий файл, окремі фрейми `Landing …`)

Done:

- під кнопкою два центровані рядки: текст і лінк на `/sources`;
- поведінка з розділу Keep працює;
- `tsc --noEmit`, `npm test`, `npm run test:ui`, `npm run verify` проходять;
- desktop і mobile перевірені в браузері (preview Vercel);
- `git diff --stat` відповідає задачі.
