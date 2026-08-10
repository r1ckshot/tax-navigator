---
id: S-<N>
epic: <feature-slug>
project: tax-navigator
wave: <K>
priority: <Must | Should | Could>
estimate: <0.5d | 1d | 2d>
blocks: [<S-X>, <S-Y>]
blocked_by: [<S-Z>]
status: todo
context_budget: ~<N> tokens
created: <YYYY-MM-DD>
---

# S-<N> · <one-line description>

**Epic:** [[_epic|<feature-slug>]]
**Priority:** <Must | Should | Could>
**Estimate:** <0.5d | 1d | 2d>
**Wave:** <K>

## Місце в послідовності

- **Блокується:** <S-Z, or "нічим (foundation)">
- **Блокує:** <S-X, S-Y, or "нічим (terminal)">
- **Чому в цій хвилі:** <одне речення — яка передумова має бути готова; чому цей story
  може йти поряд із сусідами по хвилі, а не чому "так зручніше">

## Why (user story)

**Як** <роль>, **я хочу** <дія>, **щоб** <вигода>.

<Lift from PRD US-NN verbatim where possible. Story об'єднує кілька US? Одне речення +
перелік ID: "Combines US-02 + US-05 (AC-08,09) — той самий модуль/та сама гілка потоку".>

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#<заголовок потоку §6>]] — <Covered/Trivial/Missing за власною
  таблицею покриття §6; якщо Missing — чесна нотатка, не мовчання>
- 🗄 Data delta: див. нижче
- 🌐 API contract: <events.md excerpt | cli.md excerpt | openapi.yaml excerpt |
  `_API surface: none — internal story._`> — форма за тим, що РЕАЛЬНО є в `contracts/`
  цієї фічі, не курсовий HTTP-дефолт (SKILL.md → «API contract excerpt»)
- 📜 Relevant ADR: [[../adr/<NNNN>-<title>|ADR-<NNNN>]]
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
NEW table `<table_name>` (FK <parent_table>.id) — з data-model.md, не вигадана.
DELTA `<existing_table>` — <яке поле, чому саме тут пишеться>.
Migration files: staged під docs/features/<slug>/migrations/ (якщо є) — цей репо не має
живого migrations/ дерева (docs/architecture-map.md §Сховища даних).
```

<Для story без DB-дотику: `_No data layer changes._` — gate #2 приймає це лише якщо
дійсно нема жодного NEW/DELTA; порожній story без причини — привід перевірити нарізку.>

## API contract

<Один із чотирьох варіантів SKILL.md → «API contract excerpt»:>

```
event: <name> (contracts/events.md)
  data.<field>: <type> — <джерело з data-model.md колонки>
```

<АБО `_API surface: none — internal story._` для worker/foundation-story без інтерфейсу.>

## Acceptance criteria (GWT)

- [ ] **AC-<N>:** Given <контекст>, when <дія>, then <спостережуваний результат>.
- [ ] **AC-<N+1>:** Given <контекст>, when <дія>, then <спостережуваний результат>.

<PRD AC ID зберігається дослівно. Мінімум 2 на story; якщо PRD дає лише 1 — derived AC
(sequence-крок чи data-model housekeeping поле), позначений "(derived)", не вигаданий
поза джерелами.>

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — <дія, ≤30 хв, називає файл із `scripts/<slug>/*.mjs` чи `app/lib/**` —
  реальний шлях із SKILL.md → «Reference-шляхи», не `internal/domain/`>
- [ ] Step 2 — <дія, ≤30 хв>
- [ ] Step 3 — <дія, ≤30 хв>

<Мінімум 3 кроки. Sentinel errors (де застосовно) — реальне доменне поле
(`failure_reason`, `reason`) чи `throw Error`+`process.exit(1)` патерн, не вигаданий
`module.error_name`-реєстр (SKILL.md → «Sentinel errors»).>

## Edge cases (optional)

| Кейс | Поведінка |
|---|---|
| <один рядок з PRD abuse cases чи sad.md §11 Ризики> | <очікувана поведінка> |

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-<N>-<slug>.md`).
- [ ] `tracker.md` оновлено: status `done`.
