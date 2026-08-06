<!-- Формат: MADR. Спавнено sdlc:architecture-design (§4, стовп 4) — 2 з 3 масштабу удару
(мультимодульно + чесна альтернатива; незворотнє — межово). -->

---
status: Accepted
owner: "Mike"
reviewers: []
updated_at: "2026-08-06"
feature_size: "M"
stage: "04-05"
ticket: "—"
---

# 0003 — Own allowlist array in the script instead of parsing firewall config

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Mike + Claude (architecture-design, Socratic walk)

## Context

AC-02 забороняє автозвірку будь-якого джерела поза allowlist-скоупом.
`CLAUDE.md` уже вимагає, щоб список дозволених доменів збігався в
`.devcontainer/init-firewall.sh` і `.claude/settings.json` — розбіжність
валить `npm run verify`. Питання: чи цей скрипт додає ТРЕТЮ копію того
самого списку, чи читає його з наявного джерела.

## Decision drivers

- AC-02 — межа домену, яку не можна тихо розширити чи звузити.
- `CLAUDE.md`: allowlist уже мусить збігатися у двох місцях; розбіжність
  ловить машинна перевірка.
- PRD §8: дефолтний скоуп зараз — лише 2 перевірені домени (`zus.pl`,
  `podatki.gov.pl`) із 6 у firewall allowlist; решта в firewall, але
  скриптована доступність не підтверджена (`.claude/rules/preflight.md`).

## Considered options

1. **Власний список у скрипті** — жорстко заданий масив із 2 доменів, які
   реально пройшли перевірку доступності (`environment-limits.md`), не всі,
   що є у firewall.
2. **Парсити `init-firewall.sh` як єдине джерело істини** — скрипт читає
   список доменів звідти на льоту.

## Decision outcome

**Обрано:** Опція 1. Allowlist автозвірки (AC-02) — **вужчий** підмножина
firewall-allowlist за визначенням: firewall дозволяє мережевий доступ, але
не гарантує, що джерело реально віддає скриптований контент (`biznes.gov.pl`,
`gov.pl`, `stat.gov.pl`, `eureka.mf.gov.pl` — у firewall є, доступність не
перевірена, PRD §8). Парсити firewall-конфіг дав би хибне враження, що всі
6 доменів автоматично звірювані, хоча підтверджено лише 2. Третя копія
списку — прийнятна ціна за це семантичне розділення; ризик дрейфу
**залишається відкритим** (див. Negative) — не знімається сам собою,
потребує окремого anti-drift тесту (`sad.md` §10 QG-5, доданого на кроці 7
критиком).

## Consequences

**Positive**
- Явно видно межу автозвірки (AC-02) окремо від межі мережевого доступу
  (firewall) — дві різні речі, дві різні причини існування.
- Розширення allowlist автозвірки (PRD §8 відкрите питання) — свідома дія
  в цьому скрипті, а не побічний ефект правки firewall.

**Negative**
- Третя копія переліку доменів у репо (поруч із `init-firewall.sh` і
  `.claude/settings.json`) — ризик дрейфу, якщо забути оновити всі три при
  розширенні.

**Neutral**
- Anti-drift тест (перевіряє, що allowlist скрипта — підмножина
  firewall-allowlist, не навпаки) — природний кандидат для §10 Quality
  requirements цієї ж SAD.

## Links

- PRD: [[../PRD.md]] AC-02, §8
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-normalize-then-compare-numeric-values]] — allowlist гейтить, які записи взагалі доходять до diff-детектора цього ADR
