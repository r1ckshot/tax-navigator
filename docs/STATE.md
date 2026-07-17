# STATE — живий стан проєкту (веде Claude Code, оновлення = частина DoD)

## Фаза
Курс: M3 закінчується завтра, M4 стартує. Продукт: pre-code.

## Поточні задачі
1. [x] M3 capstone (Шлях B): здано (`docs/capstones/m3.md`). Post-submission: реальне відкриття devcontainer виявило 3 нові баги (CRLF checkout, домени логіну, права на named volumes) — виправлено й закомічено окремою сесією, деталі DECISIONS.md 2026-07-17. Стан capstone-чернетки лишається як здано, без змін заднім числом.
2. [ ] Репо: git-репо ініціалізовано з паку (див. "Зроблено" нижче). Порожній Next.js + деплой на Vercel (internal URL, без домену) — окрема майбутня сесія.
3. [ ] G1-тест: рішення — без лендінгу/email, чистий Telegram-сигнал (ціль ≥5 явних "коли можна купити", OR-гілка ворот). Тексти постів готові — `docs/capstones/g1-outreach-messages.md` (поза git). Лишилось: відправити руками в 4 канали (DISTRIBUTION §1), коли зручно — не блокує решту.

## Зроблено (ця сесія)
- Git-репо ініціалізовано з паку: 1 чистий коміт (`Co-Authored-By: Claude Sonnet 5`), гілка `feat/m3-capstone-config`.
- README.md переструктуровано (публічна презентація продукту); CLAUDE.md створено (тверді правила + git-етикет, автозавантажується кожної сесії).
- `.claude/settings.json` (Project): permissions (deny секретів + незворотних команд, allow під Next.js/Drizzle стек, `ask` на `git commit`/`git push`), sandbox-блок (denyRead, allowedDomains без statsig/sentry + vercel.com/neon.tech), env (privacy-прапорці, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=75`).
- Local tier (`.claude/settings.local.json.example`) + User tier (`~/.claude/settings.json`) — глобальний User-файл очищено від секретів (2 Notion API-токени, Supabase anon-key, DB-пароль у plaintext), `attribution` і `$schema` виправлено.
- `package.json` + `scripts/verify.mjs` + `Makefile` — `npm run verify` працює крос-платформно (Windows-хост без make/python3).
- `.devcontainer/` (Dockerfile, devcontainer.json, init-firewall.sh, TZ=Europe/Warsaw) + `tests/*.sh` + `docker-compose.yml`.
- `.env.example` з полями проєкту (ANTHROPIC_API_KEY, DATABASE_URL, NEXT_PUBLIC_APP_URL, LOG_LEVEL).
- Виправлено 2 wildcard-баги: `.env.*` у `permissions.deny` і в `.gitignore` блокував/ігнорував власний `.env.example` — замінено на точні suffix-и / негацію.
- Реальний runtime-тест усіх 4 рівнів у Docker: знайдено й виправлено 4 баги, успадковані зі starter-шаблону курсу (`getent`+`pipefail` тихо вбиває `init-firewall.sh`, `curl -f` хибно трактує HTTP 404 як "заблоковано", `iptables -L` без root завжди SKIP-ає firewall-тест, `node:20` замість `node:22` для актуального Claude Code). Деталі — `DECISIONS.md`.
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` вирівняно на 60 (було 75) — узгоджено з власним ручним правилом `SESSIONS-GUIDE.md` ("60–70% → /compact").
- Реальний `.claude/settings.local.json` створено (копія `.example`, docker compose allow — тепер актуально, `.devcontainer/` існує).
- `DECISIONS.md`: 3 нових записи (README/CLAUDE.md split + приватність research/notes; permissions.deny suffix-фікс; 4 runtime-баги starter-шаблону).

## Змінилось
- Основний шлях верифікації — `npm run verify`, не `make` (Windows-хост без make/python3); Makefile лишається для CI/devcontainer.
- `research/`, `docs/notes/`, `docs/capstones/`, `docs/features/` — поза git (репо публічне, приватні/сирі дані).
- Model-routing за типом задачі (Opus/Sonnet/Fable) задокументовано в `SESSIONS-GUIDE.md`, не в settings.json (технічно неможливо — один дефолт на tier).

## Спливло / блокери
- `~/.claude/settings.json` завантажується один раз на старті сесії — правки permissions.deny не підхоплюються поточною сесією, лише наступною.
- Bash-редирект (`> .env`) обходить `Edit`/`Write`-permission-деny — закривається лише OS-рівнем sandbox (devcontainer/WSL2), не на native Windows. Тримати в увазі, не виправлено технічно (свідомо, per розмову цієї сесії).

## Наступне після поточних
- Задача 2 (нова сесія, рекомендований наступний крок): порожній Next.js + деплой Vercel — pivot-safe, не залежить від сигналу G1, можна починати вже зараз.
- G1: тексти готові, відправка руками паралельно з M4, коли зручно.
- M6 очікування: перед SDLC — фіналізувати P1-matrix числа web-fetch'ем з офіційних джерел.
