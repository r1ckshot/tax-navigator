---
id: S-2
epic: rules-change-monitor
project: tax-navigator
wave: 2
priority: Must
estimate: 2.5d
blocks: [S-4, S-5]
blocked_by: [S-1]
status: todo
context_budget: ~2600 tokens
created: 2026-08-10
---

# S-2 · Основний пайплайн звірки: фетч → нормалізація → diff (happy + недоступність)

**Epic:** [[_epic|rules-change-monitor]]
**Priority:** Must
**Estimate:** 2.5d
**Wave:** 2

## Місце в послідовності

- **Блокується:** S-1 — потребує схеми `cycle_runs`/`rule_checks` і `allowlist.mjs`.
- **Блокує:** S-4 (veto-гілка потребує вже фетчнутого значення), S-5 (звіт читає результат).
- **Чому в цій хвилі:** може будуватись паралельно з S-3 — цей story і S-3 обидва мають єдину спільну залежність (S-1), а один одного не потребують: S-3 (allowlist/verify-гейт) явно НЕ звертається до джерела (sad.md Потік 3), тож не чекає на фетч цього story.

## Why (user story)

**Як** Хранитель матриці, **я хочу** щоб раз на місяць скрипт автоматично звіряв значення zus.pl/podatki.gov.pl із записами `rules.2026.json`, розрізняв косметику від змістовної зміни, і чесно позначав недоступність джерела, **щоб** не проводити повний ручний перечит і не пропускати перевірку мовчки.

Combines US-01 (AC-01) + US-03 (AC-04, AC-05) + US-05 (AC-08, AC-09) — той самий файловий ланцюг `sources.mjs`→`normalize.mjs`→`diff.mjs`(happy/unavailable гілки)→`state.mjs`, Потік 1 і Потік 2 sad.md §6.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: місячний цикл, happy path]] (AC-01, AC-04/05) + [[../sad.md#Критичний потік 2: джерело недоступне]] (AC-08, AC-09) — обидва Covered за власною таблицею покриття §6.
- 🗄 Data delta: див. нижче
- 🌐 API contract: див. нижче (`rule_check.v1`)
- 📜 Relevant ADR: [[../adr/0001-normalize-then-compare-numeric-values|ADR-0001]] (нормалізація→порівняння), тактична пауза-стовп §4.2 (без окремого ADR — inline)
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
DELTA `cycle_runs` — started_at, month (SET при старті циклу, ще не completed).
NEW/DELTA `rule_checks` — по одному рядку на запис у скоупі allowlist (S-1):
  happy: source_value, matrix_value, diff_percent, state ∈ {'matches','cosmetic','substantive'}
  unavailable: source_value = NULL, failure_reason ∈ {'timeout','waf_block','challenge_page'}
    (CONTEXT.md → Sentinel errors), state = 'unavailable_retry'
Migration: те саме, що S-1 (rule_checks вже існує) — цей story лише ПИШЕ рядки, не змінює схему.
```

## API contract

```
event: rules_change_monitor.rule_check.v1 (events.md)
  data.state: matches | cosmetic | substantive | unavailable_retry (частина 7-станового набору AC-03)
  data.source_value: string | null (null при unavailable_retry)
  data.failure_reason: string | null (заповнено лише при unavailable_retry, AC-08)
  data.diff_percent: number | null (заповнено лише при substantive, AC-04/05)
  Idempotency: cycle_runs.month UNIQUE — не event_id (events.md → Idempotency & retry).
```

## Acceptance criteria (GWT)

- [ ] **AC-01:** Given скриптовані джерела доступні й запис `rules.2026.json` існує, when настає місячний цикл звірки, then система звіряє поточне значення джерела зі значенням матриці і записує результат для кожного запису.
- [ ] **AC-04:** Given значення джерела відрізняється від матриці лише форматуванням, when diff-детектор порівнює значення, then запис позначається «косметична відмінність», не «розбіжність», і не потрапляє в список для ручного рішення.
- [ ] **AC-05:** Given значення джерела відрізняється по суті (інше число після нормалізації формату), when diff-детектор порівнює значення, then запис позначається «розбіжність» і потрапляє в список для рішення Хранителя.
- [ ] **AC-08:** Given джерело недоступне (timeout, WAF, challenge-сторінка), when система намагається звірити запис, then запис отримує стан «не вдалось перевірити», а не «збігається» чи «розбіжність», і причина недоступності записується поруч.
- [ ] **AC-09:** Given запис отримав стан «не вдалось перевірити» у минулому циклі, when настає новий цикл, then система повторює спробу звірити саме цей запис, а не пропускає його назавжди.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Реалізувати `sources.mjs`: фетч значення для кожного `rule_id` у allowlist-скоупі (S-1), фіксована пауза між запитами до одного домену (§4 стовп 2) — цикл `zus.pl` окремо від циклу `podatki.gov.pl`.
- [ ] Step 2 — Реалізувати `normalize.mjs` (ADR-0001): парсити число з сирого тексту джерела, порівняти числове значення з `matrix_value`; результат — `diff_percent` + прапорець «косметика/суть».
- [ ] Step 3 — У `diff.mjs`: happy-гілка присвоює `state` за результатом normalize (`matches`/`cosmetic`/`substantive`), пише `rule_checks` (AC-01, AC-04, AC-05).
- [ ] Step 4 — У `diff.mjs`: гілка недоступності — при помилці фетчу (`timeout`/`waf_block`/`challenge_page`, CONTEXT.md Sentinel errors) присвоює `state = 'unavailable_retry'`, пише `failure_reason` (AC-08).
- [ ] Step 5 — `state.mjs`: перед фетчем перевіряти історію попереднього циклу — якщо запис був `unavailable_retry`, включити в список цього циклу знову, не пропускати (AC-09).

## Edge cases (optional)

| Кейс | Поведінка |
|---|---|
| Джерело повертає значення, що збігається з ветованою цифрою (AC-10) | Поза межами цього story — гейт S-4 (Потік 3 veto-гілка) переклассифікує ПІСЛЯ того, як цей story записав `source_value` |
| Обидва домени (`zus.pl`, `podatki.gov.pl`) недоступні в одному циклі | Кожен запис отримує власний `failure_reason` незалежно — цикл не падає повністю, `cycle_runs.status` лишається `partial` (S-5 виставляє фінальний статус) |

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-2-rules-change-monitor.md`).
- [ ] `tracker.md` оновлено: status `done`.
