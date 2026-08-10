---
id: S-3
epic: rules-change-monitor
project: tax-navigator
wave: 2
priority: Must
estimate: 1.5d
blocks: [S-4, S-5]
blocked_by: [S-1]
status: todo
context_budget: ~2400 tokens
created: 2026-08-10
---

# S-3 · Класифікаційний гейт без фетчу: поза allowlist, ще не верифіковано

**Epic:** [[_epic|rules-change-monitor]]
**Priority:** Must
**Estimate:** 1.5d
**Wave:** 2

## Місце в послідовності

- **Блокується:** S-1 — потребує `allowlist.mjs` і схеми `rule_checks`.
- **Блокує:** S-4 (veto-гілка того самого `alt`-блоку `diff.mjs`, продовжує цей класифікаційний патерн), S-5 (звіт читає ці записи теж).
- **Чому в цій хвилі:** може будуватись паралельно з S-2 — обидва гілки `diff.mjs`'s `alt`-блоку, але ЦІ дві гілки (allowlist-скоуп, ще-не-верифіковано) явно НЕ звертаються до джерела (sad.md Потік 3: «без звернення до джерела» / «звірка не застосовується»), тож не мають реальної залежності від фетчу, який виконує S-2.

## Why (user story)

**Як** Хранитель матриці, **я хочу** щоб записи поза allowlist-скоупом і щойно додані невірифіковані записи отримували явний, окремий стан, а не тихо змішувались зі звичайною звіркою, **щоб** я знав, які записи взагалі поза автоматичною перевіркою.

Combines US-01 (AC-02, authorization) + US-04 (AC-07, cross-context) — одна й та сама класифікаційна точка входу `diff.mjs`, гілки `alt`-блоку Потоку 3, що не потребують фетчнутого значення джерела.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 3: класифікація стану запису — allowlist, верифікація, veto (AC-02, AC-07, AC-10)]] — Covered (AC-02, AC-07), перші дві гілки `alt`-блоку.
- 🗄 Data delta: див. нижче
- 🌐 API contract: див. нижче (`rule_check.v1`)
- 📜 Relevant ADR: [[../adr/0003-own-allowlist-in-script-not-parsed-from-firewall-config|ADR-0003]]
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
NEW `rule_checks` рядки для записів, що НЕ проходять через S-2 взагалі:
  поза allowlist: state = 'out_of_scope', source_value = NULL, matrix_value = <з rules.2026.json>
  ще не верифіковано: state = 'not_verified', source_value = NULL
Ці рядки не перетинаються з S-2's — S-2 обробляє лише записи ВСЕРЕДИНІ allowlist-скоупу,
що вже пройшли первісну верифікацію через /scaffold-rule.
```

## API contract

```
event: rules_change_monitor.rule_check.v1 (events.md)
  data.state: out_of_scope | not_verified (частина 7-станового набору AC-03)
  data.source_value: null (обидві гілки — "без звернення до джерела")
  Origin: sad.md §6 Потік 3, перші дві гілки alt-блоку.
```

## Acceptance criteria (GWT)

- [ ] **AC-02:** Given `rule_id`, чиє джерело веде на домен поза allowlist скриптованих (`isap.sejm.gov.pl`, `tax.gov.ua` чи будь-який інший непідтверджений домен), when цикл звірки формує список записів для перевірки, then система ніколи не звертається до цього джерела автоматично й позначає запис «поза автозвіркою — ручна перевірка».
- [ ] **AC-07:** Given запис `rules.2026.json` ще не пройшов первісну верифікацію через `/scaffold-rule` (щойно доданий), when цикл звірки запускається, then система позначає такий запис станом «ще не верифіковано» — окремим від «розбіжність», бо звірка застосовується лише до вже верифікованих записів.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — У `diff.mjs`: перед формуванням списку записів для `sources.mjs`, перевірити `source_url` кожного запису `rules.2026.json` проти `allowlist.mjs` (S-1) — якщо поза скоупом, одразу `state = 'out_of_scope'`, пропустити фетч (AC-02).
- [ ] Step 2 — Перевірити, чи запис має `verified_at` (інваріант reference-модуля `app/lib/rules/types.ts`, той самий, що PRD цитує) — якщо ще не верифіковано, `state = 'not_verified'`, пропустити фетч (AC-07).
- [ ] Step 3 — Записати обидва типи рядків у `rule_checks` цього циклу (`cycle_id` з `cycle_runs`, S-1) — без `source_value`, без звернення до `sources.mjs`.
- [ ] Step 4 — Тест: запис зі свідомо не-allowlist `source_url` (напр. `isap.sejm.gov.pl`, `environment-limits.md`) ніколи не породжує HTTP-запит під час прогону цього тесту (AC-02 negative-assertion, не лише позитивний стан).

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] AC-02 negative-assertion: запис із `source_url` поза allowlist ніколи не породжує HTTP-запит під час тесту (мокований fetch не викликається жодного разу для цього `rule_id`).
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-3-rules-change-monitor.md`).
- [ ] `tracker.md` оновлено: status `done`.
