# STATE — живий стан проєкту (веде Claude Code, оновлення = частина DoD)

## Фаза
Курс: Module 3 (Claude Code Setup), дедлайн модуля ~1 тиждень. Продукт: pre-code.

## Поточні задачі
1. [ ] M3 capstone (Шлях B): адаптувати starter `docs/course/.../3.9-starters/nodejs-typescript` під цей проєкт — permissions.allow під стек (Next.js, Drizzle, Vitest), sandbox.network.allowedDomains (+ api.anthropic.com, registry.npmjs.org, github.com, vercel.com, neon.tech; пізніше biznes.gov.pl/zus.pl/podatki.gov.pl для звірки правил), deny на секрети, .env.example, `make verify`. Здача: опис проєкту + шлях B + який рівень закрив + одне найважливіше рішення (наше: deny секретів + network allowlist, бо фінансовий продукт).
2. [ ] Репо: ініціалізувати з цього паку, порожній Next.js, деплой на Vercel (internal URL, без домену).
3. [ ] Лендінг+waitlist (G1) — окрема задача після 1–2: одна сторінка з болем (голоси з EVIDENCE §3) + email; пости за DISTRIBUTION §1.

## Останній handoff
— (перша сесія ще не проведена)

## Спливло / блокери
— немає

## Наступне після поточних
M6 очікування: перед SDLC — фіналізувати P1-matrix числа web-fetch'ем з офіційних джерел.
