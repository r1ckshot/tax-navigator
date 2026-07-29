# STATE — де ми зараз

Веде Claude Code, оновлення = частина DoD. Тримати в межах однієї сторінки:
історія йде в [JOURNAL.md](JOURNAL.md), рішення — в [DECISIONS.md](DECISIONS.md), черга задач — у [BACKLOG.md](BACKLOG.md).

## Фаза

**Курс:** M4 здано (`docs/capstones/m4.md`), M6 у роботі — пройдено ideation по
фічі `tg-assistant`, далі PRD і tasks. M5 частково випереджено (скіл `interview`,
хуки зроблені на реальній потребі), лишається наздогнати plugins / marketplace / SDK.

**Продукт:** FREE-анкета в проді на Vercel — вердикт резидентства + порівняння
4 сценаріїв рахуються детерміновано на клієнті. 74 node-тести + 8 UI зелені.

**Ворота:** G1 перевідкриті (провалився канал, не попит — DECISIONS 2026-07-28).
G2 (10/10 профілів проти держкалькуляторів) не пройдені — закріплено 1 калібрувальний.

## Зараз у роботі

**Розчистка задач і документів** — щоб нова сесія за хвилину відповідала «що далі».

Готово коли:
- [x] Укр-домени в `init-firewall.sh` (Claude) і в `.claude/settings.json` (Mike) → `npm run verify` зелений
- [x] Хуки в `settings.json` (Mike) — PreToolUse / PostToolUse / SessionStart активні
- [x] `environment-limits.md` врізано, форензика 9p → JOURNAL
- [x] Фаза курсу однакова в CLAUDE.md / README / PROJECT / SESSIONS-GUIDE / STATE
- [x] STATE ≤ 1 сторінка, історія в JOURNAL
- [x] BACKLOG перебудовано в чергу NOW / NEXT / LATER
- [x] CLAUDE.md: глибина SDLC за розміром фічі + тест «де живе чому»
- [ ] `hooks.suggested.md` видалено (перехідний файл відпрацював)
- [ ] Тести зелені, коміти атомарні, DECISIONS оновлено

**Заміряно при перевірці:** `zakon.rada.gov.ua` → 200 (джерело ПКУ доступне);
`tax.gov.ua` → 403 від Akamai WAF навіть із браузерним UA — як джерело для fetch
непридатний; `www.tax.gov.ua` → 000, IP зротувались за півдня. Деталі — в
`environment-limits.md`.

## Живі блокери

- **`.claude/settings.json` править лише Mike** — Claude Code не редагує власний
  settings (жорсткий класифікатор). Готую блок, застосовує Mike.
- **`~/.claude/settings.json` читається раз на старті сесії** — правки підхоплює
  лише наступна сесія.
- **`next build` у цьому контейнері не запускаємо** — перевірка через `tsc --noEmit`
  + `npm test` + `npm run test:ui`; продакшн-збірку валідує Vercel.
- **G2 не пройдені** — движок не вважається готовим, поки нема 10/10 профілів.

Решта відомих меж середовища — [.claude/rules/environment-limits.md](../.claude/rules/environment-limits.md).

## Наступне

1. `tg-assistant` T1+T2 — новий канал вимірювання G1. Розмір S → короткий PRD, далі
   `tasks/`. Критерій зупинки записаний наперед: 6 циклів, <5 питань → півот.
2. M6 далі за мапою модулів (`SESSIONS-GUIDE.md`).
3. Якщо `zakon.rada.gov.ua` відкрився — звірка ставок ЄСВ/ВЗ за ПКУ знімає
   «сценарій ФОП без цифр» (EVIDENCE, сценарій A).

Повна черга — [BACKLOG.md](BACKLOG.md).
