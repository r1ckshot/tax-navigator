---
id: S-4
epic: rules-change-monitor
project: tax-navigator
wave: 3
priority: Must
estimate: 1d
blocks: [S-5]
blocked_by: [S-2, S-3]
status: todo
context_budget: ~2000 tokens
created: 2026-08-10
---

# S-4 · Veto-перевірка: захист від повернення скасованої цифри

**Epic:** [[_epic|rules-change-monitor]]
**Priority:** Must
**Estimate:** 1d
**Wave:** 3

## Місце в послідовності

- **Блокується:** S-2 (потрібне вже фетчнуте `source_value`, щоб порівняти з veto-списком) і S-3 (той самий класифікаційний патерн `diff.mjs` `alt`-блоку — продовжує його третьою гілкою).
- **Блокує:** S-5 — звіт має враховувати й veto-перекласифіковані записи.
- **Чому в цій хвилі:** третя гілка `alt`-блоку Потоку 3 — на відміну від перших двох гілок (S-3), ця ПОТРЕБУЄ фетчнутого значення джерела (порівнює його з `veto_entries.vetoed_value`), тож не може бути в хвилі 2 разом з S-3 — реальна залежність, не штучна.

## Why (user story)

**Як** Хранитель матриці, **я хочу** щоб нове значення джерела, яке збігається з відомою ветованою/скасованою цифрою, отримувало окремий стан і вимагало мого явного підтвердження, **щоб** скрипт не тихо прийняв уже раз відкинуту цифру як «нове» значення.

US-02 (AC-10, edge case, доданий через Edit при write-prd — idea-brief §9 назвав це витривалим edge case).

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 3: класифікація стану запису — allowlist, верифікація, veto (AC-02, AC-07, AC-10)]] — Covered (AC-10), третя гілка `alt`-блоку.
- 🗄 Data delta: див. нижче
- 🌐 API contract: див. нижче (`rule_check.v1`)
- 📜 Relevant reference: `veto_entries` (`data-model.md`) — калібрувальний приклад: ставки реформи zdrowotnej 2025.
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
DELTA `rule_checks` — для записів зі S-2, чий `source_value` збігається з `veto_entries.vetoed_value`
  (той самий `rule_id`): перезаписати `state` з попереднього ('matches'/'substantive') на
  'needs_confirmation'. READ `veto_entries` по `rule_id` (idx_veto_entries_rule_id, S-1).
NO NEW TABLE — читає S-1's `veto_entries`, пише поверх S-2's `rule_checks` рядка.
```

## API contract

```
event: rules_change_monitor.rule_check.v1 (events.md)
  data.state: needs_confirmation (частина 7-станового набору AC-03)
  Origin: sad.md §6 Потік 3, третя гілка alt-блоку («значення джерела збігається з відомою
  ветованою цифрою»).
```

## Acceptance criteria (GWT)

- [ ] **AC-10:** Given нове значення джерела збігається з відомою ветованою/скасованою цифрою (напр. ставки реформи zdrowotnej 2025), when diff-детектор порівнює його з матрицею, then система позначає це станом «потребує підтвердження» і вимагає явного підтвердження Хранителя перед прийняттям, а не тихо приймає як «нове» значення джерела.
- [ ] **AC-derived (regression, з idea-brief §10):** Given `veto_entries` містить запис для конкретного `rule_id`, when цикл повторюється наступного місяця і джерело знову повертає те саме ветоване значення, then запис знову отримує `needs_confirmation`, а не одноразово — veto діє для КОЖНОГО циклу, доки Хранитель явно не оновить матрицю.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Після завершення S-2 (значення джерела вже у `rule_checks.source_value`), для кожного запису зі `state` ∈ {matches, substantive} шукати `veto_entries` по тому самому `rule_id`.
- [ ] Step 2 — При збігу `source_value` з `veto_entries.vetoed_value` — перезаписати `rule_checks.state = 'needs_confirmation'` (AC-10).
- [ ] Step 3 — Тест на anti-regression: калібрувальний приклад ставки реформи zdrowotnej (`EVIDENCE.md`, ветована цифра) — цикл ніколи не позначає її `matches`/`substantive`, лише `needs_confirmation`, скільки б разів цикл не повторювався.

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] Anti-regression на калібрувальний приклад ставки реформи zdrowotnej (`EVIDENCE.md`): цикл повторюється 3 рази поспіль, стан лишається `needs_confirmation` щоразу, ніколи не переходить у `matches`.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-4-rules-change-monitor.md`).
- [ ] `tracker.md` оновлено: status `done`.
