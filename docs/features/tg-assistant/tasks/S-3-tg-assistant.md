---
id: S-3
epic: tg-assistant
project: tax-navigator
wave: 3
priority: Must
estimate: 1.5d
blocks: [S-4]
blocked_by: [S-2]
status: todo
context_budget: ~1700 tokens
created: 2026-08-10
---

# S-3 · Розмітити питання «покрито»/«біла пляма» проти rules-матриці

**Epic:** [[_epic|tg-assistant]]
**Priority:** Must
**Estimate:** 1.5d
**Wave:** 3

## Місце в послідовності

- **Блокується:** S-2 — labeler працює лише над органічними питаннями (`is_organic = TRUE`), без результату фільтра розмічати нема що.
- **Блокує:** S-4 — reporter читає мітки.
- **Чому в цій хвилі:** третій модуль лінійного пайплайна (`labeler.ts`, sad.md §5).

## Why (user story)

**Як** Дослідник ринку, **я хочу** щоб кожне питання звірялось із поточною rules-матрицею, **щоб** я одразу бачив, де навігатор уже відповідає, а де прогалина.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: тижневий цикл збору — авторизовані чати, дедуп при надолуженні (AC-01, AC-02, AC-09)]] — Missing (labeler-крок не намальований окремо).
- 🗄 Data delta: див. нижче
- 🌐 API contract: `_API surface: none — internal story._`
- 📜 Relevant reference: `app/lib/rules/types.ts` — інваріант `Rule {rule_id, params, source_url, verified_at}` і `getRule(rule_id)` (PRD «Reference-модуль»).
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
NEW table `question_labels` (FK message_id → messages.id, UNIQUE — 1:1)
Migration file (staged): 20260807120004_create_question_labels.{up,down}.sql
NO updated_at — рядок immutable від створення (закриває AC-06 самою відсутністю UPDATE-шляху).
```

## API contract

`_API surface: none — internal story._`

## Acceptance criteria (GWT)

- [ ] **AC-05:** Given органічне питання і чинна rules-матриця, when система розмічає питання, then мітка «покрито» цитує конкретний `rule_id` чинної матриці, а мітка «біла пляма» супроводжується підтвердженням, що жодне правило матриці йому не відповідає.
- [ ] **AC-06:** Given питання зіставляється з rules-матрицею на момент циклу, when rules-матриця оновлюється між тижневими циклами, then історичні мітки попередніх звітів не переписуються заднім числом.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Реалізувати `labeler.ts`: для кожного `messages` з `is_organic = TRUE` викликати `getRule`-подібний пошук по `rules.2026.json` через `app/lib/rules/types.ts` (AC-05).
- [ ] Step 2 — При знайденому правилі писати `question_labels.label = 'covered'` + `rule_id`; при відсутності — `label = 'white_spot'`, `rule_id = NULL` (AC-05).
- [ ] Step 3 — НЕ реалізовувати UPDATE-шлях для вже існуючого `question_labels` рядка — новий цикл для того самого `message_id` неможливий (message вже дедуплікований на S-1), тож immutable-by-construction закриває AC-06.
- [ ] Step 4 — Додати тест: зміна `rules.2026.json` між двома прогонами циклу не змінює мітку, записану в попередньому тижні (AC-06 anti-regression).

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] AC-06 anti-regression: зміна `rules.2026.json` між двома прогонами циклу не переписує `question_labels` попереднього тижня — мутація (навмисна зміна `rule_id` у фікстурі) мусить завалити тест, якщо immutable-гарантія зникла.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-3-tg-assistant.md`).
- [ ] `tracker.md` оновлено: status `done`.
