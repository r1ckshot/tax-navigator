---
id: S-4
epic: tg-assistant
project: tax-navigator
wave: 4
priority: Must
estimate: 1d
blocks: []
blocked_by: [S-3]
status: todo
context_budget: ~1800 tokens
created: 2026-08-10
---

# S-4 · Зібрати тижневий звіт

**Epic:** [[_epic|tg-assistant]]
**Priority:** Must
**Estimate:** 1d
**Wave:** 4

## Місце в послідовності

- **Блокується:** S-3 — звіт читає мітки `question_labels` і недоступні чати `cycle_chat_failures` (з S-1).
- **Блокує:** нічим (terminal — останній модуль пайплайна).
- **Чому в цій хвилі:** четвертий, фінальний модуль лінійного пайплайна (`reporter.ts`, sad.md §5) — читає вихід усіх попередніх.

## Why (user story)

**Як** Дослідник ринку, **я хочу** тижневий звіт із кожним питанням, його міткою і посиланням на першоджерело, **щоб** я міг перевірити будь-який пункт вручну.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: тижневий цикл збору]] — Missing (reporter-крок не намальований окремо).
- 🗄 Data delta: див. нижче
- 🌐 API contract: `_API surface: none — internal story._`
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
DELTA `cycle_runs` — SET status = 'completed', finished_at = now() по завершенню звіту
  (finished_at NULL, доки цикл не завершено — data-model.md, Entities → cycle_runs).
NO NEW TABLE — reporter лише читає messages + question_labels + cycle_chat_failures.
```

## API contract

`_API surface: none — internal story._`

## Acceptance criteria (GWT)

- [ ] **AC-07:** Given цикл завершив збір і розмітку, when дослідник відкриває тижневий звіт, then кожне питання показане з міткою «покрито»/«біла пляма» і службовим посиланням на першоджерело.
- [ ] **AC-07-derived (housekeeping):** Given усі попередні модулі пайплайна відпрацювали (S-1..S-3), when reporter завершує збірку звіту, then `cycle_runs.status` переходить у `completed`, а `finished_at` фіксується — PRD дає лише 1 AC для US-04, тож за протоколом Stage 2 п.2 додано похідний AC із `data-model.md` (не вигаданий поза джерелами).

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Реалізувати `reporter.ts`: зібрати всі `messages` тижня з `is_organic = TRUE` разом із `question_labels` (мітка + `rule_id`) і посиланням на першоджерело (chat_id + telegram_message_id).
- [ ] Step 2 — Включити явний перелік недоступних чатів цього тижня з `cycle_chat_failures.reason` (AC-08, дзеркалить S-1) — звіт не мовчить про часткову недоступність.
- [ ] Step 3 — Позначити в звіті межу вікна backfill для чатів, які пройшли через AC-10 цього тижня (S-1 крок 4) — не приховувати, що це неповна історія.
- [ ] Step 4 — По завершенню збірки виставити `cycle_runs.status = 'completed'`, `finished_at = now()` (AC-07-derived).

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-4-tg-assistant.md`).
- [ ] `tracker.md` оновлено: status `done`.
