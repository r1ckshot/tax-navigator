# STATE — живий стан проєкту (веде Claude Code, оновлення = частина DoD)

## Фаза
Курс: M4 йде. Продукт: деплой живий (порожній Next.js на Vercel); P1-matrix звірено з офіційними джерелами — дані готові до білду движка.

## Поточні задачі
1. [x] M3 capstone (Шлях B): здано (`docs/capstones/m3.md`). Post-submission баги виправлено (DECISIONS.md 2026-07-17).
2. [x] Репо: Next.js (TS, App Router) + деплой на Vercel — https://tax-navigator-red.vercel.app
3. [ ] G1-тест: тексти готові (`docs/capstones/g1-outreach-messages.md`, поза git). Лишилось: відправити руками в 4 канали (DISTRIBUTION §1), коли зручно — не блокує решту.
4. [x] **P1-matrix звірка проти офіційних джерел** — виконано цієї сесії, деталі нижче. Блокер перед M6 знято.

## Зроблено (ця сесія, 2026-07-18/2)
- Firewall: 11 офіційних PL-доменів (zus.pl, podatki.gov.pl, biznes.gov.pl, gov.pl, isap.sejm.gov.pl, stat.gov.pl, eureka.mf.gov.pl; www + apex) додано в `init-firewall.sh` (Claude) + `.claude/settings.json` (Mike руками) → застосовано через Rebuild Container; `npm run verify` зелений.
- P1-matrix (EVIDENCE §6): всі сценарії A–F + нестабільності звірено проти gov.pl / zus.pl / isap / інтерпретацій KAS. Ядро підтверджено (zdrowotna пороги, duży ZUS 1,926.76, ryczałt 12%, liniowy 19% + 14,100, skala, nierejestrowana). Виправлено: спецнорма резидентства = art. 52zr з сансетом 31.12.2026; preferencyjny 456.18 (було ~456.19). Уточнено: były pracodawca — два різні тести; мін. zdrowotna 432.54 з лютого 2026; 50% KUP ліміт 120k; KSeF для JDG з 01.04.2026. Кожен сценарій має рядок "Верифіковано 2026-07-18" + source_url.
- OPEN-RISKS §8: доповнено податковим сансетом art. 52zr (31.12.2026) + тригер для tax year 2027.
- `DECISIONS.md`: запис 2026-07-18/2 (allowlist офіційних джерел + дизайн запеченої копії firewall-скрипта; підсумки звірки; пастка цифр ветованої реформи).

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
- **M4-цілі за мапою модулів** (`SESSIONS-GUIDE.md`) — P1-matrix блокер знято, шлях до M6 (SDLC-артефакти) відкритий.
- G1: тексти готові, відправка руками паралельно з M4, коли зручно.
- На білді движка (M7): цифри тягнути fetch-ем з першоджерел (домени вже в allowlist), еталони G2 — з держкалькуляторів; пильнувати пастку цифр ветованої реформи zdrowotnej (EVIDENCE §6 "Нестабільності" п.1).
