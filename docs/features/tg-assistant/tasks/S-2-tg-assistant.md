---
id: S-2
epic: tg-assistant
project: tax-navigator
wave: 2
priority: Must
estimate: 1d
blocks: [S-3]
blocked_by: [S-1]
status: todo
context_budget: ~1400 tokens
created: 2026-08-10
---

# S-2 · Відфільтрувати органічні питання від шуму

**Epic:** [[_epic|tg-assistant]]
**Priority:** Must
**Estimate:** 1d
**Wave:** 2

## Місце в послідовності

- **Блокується:** S-1 — без зібраних `messages` фільтрувати нічого.
- **Блокує:** S-3 — labeler працює лише над органічними питаннями.
- **Чому в цій хвилі:** другий модуль лінійного пайплайна (`filter.ts`, sad.md §5).

## Why (user story)

**Як** Дослідник ринку, **я хочу** бачити лише органічні питання, а не оголошення й репости, **щоб** я не гаяв час на нерелевантне.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: тижневий цикл збору — авторизовані чати, дедуп при надолуженні (AC-01, AC-02, AC-09)]] — Missing (filter-крок не намальований окремо).
- 🗄 Data delta: див. нижче
- 🌐 API contract: `_API surface: none — internal story._`
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
DELTA `messages` — ADD write of `is_organic` (BOOLEAN, вже в схемі S-1) при обробці партії.
```

## API contract

`_API surface: none — internal story._`

## Acceptance criteria (GWT)

- [ ] **AC-03:** Given зібрані повідомлення містять і органічні питання, і шум, when система фільтрує партію, then у подальшу обробку йдуть лише органічні питання за визначенням глосарія.
- [ ] **AC-04:** Given одне повідомлення підпадає під кілька тем одразу, when система формує список унікальних питань, then повідомлення рахується рівно один раз.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Реалізувати `filter.ts` за визначенням «Органічне питання (A+)» з CONTEXT.md; відсіяти оголошення, репости, власні пости автора (AC-03).
- [ ] Step 2 — Дедуплікувати повідомлення, що підпадають під кілька тем одразу, до одного рядка перед записом `is_organic` (AC-04) — рахувати раз, не раз на тему.
- [ ] Step 3 — Записати `is_organic` для кожного повідомлення партії, включно з `FALSE` для відсіяного (не пропускати рядок мовчки — наступний модуль читає лише `is_organic = TRUE`).

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] AC-04 anti-regression: тестова партія з одним повідомленням, що підпадає під ≥2 теми одразу, дає рівно один рядок `messages` з `is_organic`, не два.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-2-tg-assistant.md`).
- [ ] `tracker.md` оновлено: status `done`.
