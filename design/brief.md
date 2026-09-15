# Design brief

Screen: Сторінка джерел `/sources`. Звідки взято кожну цифру продукту, в одному місці.

Current URL: http://localhost:3000/sources (новий маршрут). Джерела зараз видно лише
в картках результату: http://localhost:3000/questionnaire, крок результату,
компонент `SourceCitation`.

Goal: людина бачить усі 26 правил `rules.2026.json` одним списком: що це за
цифра, звідки вона і коли її востаннє звірили.

Keep:

- `SourceCitation` у картках результату лишається як є: джерело видно поруч із
  висновком (`product-safety.md`). Нова сторінка його не заміняє.
- Кольори лише з ролей словника 11.4 (`app/globals.css`, шар ролей), не з палітри.
  Межу тримає `design-tokens.test.ts`.
- Жодної цифри без `source_url` + `verified_at`; сторінка не показує значень
  ставок, лише ідентифікатор правила, джерело і дату звірки.
- Стан не несе значення самим кольором: форма + текст, як у `RiskBadge`.
- Текст українською, без порад.

States:

- default: список правил, згрупований за префіксом `rule_id` (8 груп: residency,
  common, jdg, incubator, uop, fop, zlecenie, nierejestrowana), кожне зі станом свіже.
- stale: `verified_at` старше 90 днів. Поріг той самий, що в
  `scripts/check-stale-rules.mjs`. Сьогодні таких 0, перше з'явиться 2026-10-17,
  тому стан показується на фікстурі.
- source unavailable: N/A у цьому проході. Продукт client-only і джерел не
  опитує; ця інформація живе у звітах `rules-change-monitor`, поза `app/`.
- loading: N/A. Дані статичні, читаються під час збірки.
- error: N/A. Файл правил валідується тестами до збірки.
- disabled: N/A. Інтерактивних контролів, крім посилань, немає.

Layouts:

- desktop: 1440px
- mobile: 390px

Design references:

- current screenshot: `visual/__screenshots__/{desktop,mobile}-light/result-expanded.png`
  (картка результату з `SourceCitation`)
- desktop frame: `design/sources.pen#bqeXd` (Desktop 1440 — default), `design/sources.pen#rInfN` (Desktop 1440 — stale)
- mobile frame: `design/sources.pen#pEKR8` (Mobile 390 — default)
- exports: `design/canvas/export/{desktop-default,desktop-stale,mobile-default}.png`
- Pencil source: `design/sources.pen`

Done:

- затверджений design реалізований маршрутом `/sources`;
- поведінка з розділу Keep працює;
- `tsc --noEmit`, `npm test`, `npm run test:ui`, `npm run verify` проходять;
- desktop і mobile перевірені в браузері (Mike або візуальний харнес на раннері);
- `git diff --stat` відповідає задачі.
