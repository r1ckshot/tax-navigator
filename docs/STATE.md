# STATE — живий стан проєкту (веде Claude Code, оновлення = частина DoD)

## Фаза
Курс: M4 стартувало. Продукт: перший робочий деплой (порожній Next.js на Vercel), функціонал ще не почато.

## Поточні задачі
1. [x] M3 capstone (Шлях B): здано (`docs/capstones/m3.md`). Post-submission: реальне відкриття devcontainer виявило 3 нові баги (CRLF checkout, домени логіну, права на named volumes) — виправлено й закомічено окремою сесією, деталі DECISIONS.md 2026-07-17. Стан capstone-чернетки лишається як здано, без змін заднім числом.
2. [x] Репо: git-репо ініціалізовано з паку. Порожній Next.js (TS, App Router) + деплой на Vercel — готово, деталі нижче.
3. [ ] G1-тест: рішення — без лендінгу/email, чистий Telegram-сигнал (ціль ≥5 явних "коли можна купити", OR-гілка ворот). Тексти постів готові — `docs/capstones/g1-outreach-messages.md` (поза git). Лишилось: відправити руками в 4 канали (DISTRIBUTION §1), коли зручно — не блокує решту.
4. [ ] **P1-matrix звірка проти офіційних джерел** (наступна сесія, рекомендований наступний крок, деталі нижче).

## Зроблено (ця сесія)
- Next.js (TS, App Router) вручну заскафолджений в корені репо (`create-next-app` відмовляється в непорожній директорії) — `app/layout.tsx`, `app/page.tsx`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `package.json` доповнено (`next`/`react`/`react-dom` + скрипти `dev`/`build`/`start`, старий `verify` збережено).
- `tsconfig.json` звужено до `include: app/**`, `docs/` виключено — інакше `tsc` підхоплював чужий express-стартер курсу з `docs/course/...` і білд падав.
- `npm install` + `npm run build` — зелені; гілка `feat/nextjs-scaffold` запушена, fast-forward змержена в `master`, запушена, гілку видалено (локально + origin).
- Vercel-проєкт створено через Git-інтеграцію (import repo, не CLI/токен) — деплой живий: https://tax-navigator-red.vercel.app
- Firewall: `tax-navigator-red.vercel.app` додано в allowlist (`.claude/settings.json` + `init-firewall.sh`) — apex `vercel.app` мав іншу IP, не спільний anycast з проєктним субдоменом (перевірено `getent`). `npm run verify` підтверджує синхронність.
- Виявлено: Claude Code блокує self-modification `.claude/settings.json` (permissions/sandbox) навіть з дозволом Mike в чаті — `init-firewall.sh` правив Claude, `.claude/settings.json` довелось руками Mike.
- `DECISIONS.md`: новий запис 2026-07-18 (4 рішення: manual-scaffold, Git-інтеграція Vercel, exact-hostname firewall, self-modification блок).

## Змінилось
- Основний шлях верифікації — `npm run verify`, не `make` (Windows-хост без make/python3); Makefile лишається для CI/devcontainer.
- `research/`, `docs/notes/`, `docs/capstones/`, `docs/features/` — поза git (репо публічне, приватні/сирі дані).
- Model-routing за типом задачі (Opus/Sonnet/Fable) задокументовано в `SESSIONS-GUIDE.md`, не в settings.json (технічно неможливо — один дефолт на tier).

## Спливло / блокери
- `~/.claude/settings.json` завантажується один раз на старті сесії — правки permissions.deny не підхоплюються поточною сесією, лише наступною.
- Bash-редирект (`> .env`) обходить `Edit`/`Write`-permission-деny — закривається лише OS-рівнем sandbox (devcontainer/WSL2), не на native Windows. Тримати в увазі, не виправлено технічно (свідомо, per розмову цієї сесії).
- Claude Code не редагує власний `.claude/settings.json` (permissions/sandbox) — жорсткий класифікатор, не permission-промпт. Такі правки — завжди руками Mike.
- Firewall whitelist матчить по резолвленій IP, не по SNI/hostname — apex-домен не покриває піддомени на спільних CDN/edge, якщо вони не діляться тим самим anycast IP (перевіряти `getent` перед додаванням).

## Наступне після поточних
- **P1-matrix звірка проти офіційних джерел (рекомендований наступний крок, НОВА сесія, `/model fable`):** цифри сценаріїв A–F в `EVIDENCE.md` §6 звірити з zus.pl (składka zdrowotna/społeczne пороги 2026), podatki.gov.pl (ryczałt/liniowy/skala ставки, kwota wolna), Objaśnienia MF 29.04.2021 (резидентство/тай-брейки). Блокер перед M6 (SDLC-артефакти) per `SESSIONS-GUIDE.md` мапа модулів. Model-routing: Fable 5 (найвища ціна помилки — фінансовий продукт), не Sonnet.
- G1: тексти готові, відправка руками паралельно з M4, коли зручно — не блокує P1-matrix.
