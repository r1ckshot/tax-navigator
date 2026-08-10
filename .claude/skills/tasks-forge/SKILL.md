---
name: tasks-forge
description: >-
  Особиста версія sdlc-task-packages/break-tasks — той самий 3-stage flow
  (Stage 1 slicing proposal + AskUserQuestion checkpoint → Stage 2 per-story
  генерація з 8-gate валідацією → Stage 3 `_epic.md`+`tracker.md`), але під
  практику цього репо, не курсові дефолти: (1) **вивід у
  `docs/features/<slug>/tasks/`, не `delivery/<slug>/tasks/`** — того кореня
  в репо нема, і заводити його заради одного скіла не варто; (2)
  **reference-шляхи — реальна структура репо** (`scripts/<slug>/*.mjs` для
  worker-фіч, `app/lib/**` для продуктових) — не вигадана hexagonal
  `internal/modules` розкладка з курсового Go-прикладу, якої в TS/Next.js
  client-only репо взагалі нема; (3) **API contract excerpt читає
  `events.md` АБО `openapi.yaml`** залежно від того, що реально лежить у
  `contracts/` фічі — курсовий скіл жорстко очікує `openapi.yaml`/`paths:`,
  наш читає обидва (той самий вибір, що `contract-forge`); (4) **sentinel
  errors — з реальних доменних полів** (`failure_reason`, `throw Error`+
  `process.exit(1)` патерн `sad.md` §8) — не вигаданий `module.error_name`
  реєстр, якого в жодній фічі репо нема; (5) **`.size`-based wave-scaling**
  — курсовий каже «typical 3 waves, rare 4» без прив'язки до розміру;
  власний дефолт явно зважає на `feature_size`/`.size` (S → 2-3 хвилі, M →
  3-4). Standalone, не прив'язаний до жодної фічі. Тригери: «/tasks-forge
  <slug>», «task packages через tasks-forge для <slug>», «розбий <slug> на
  stories своїм скілом». Адаптовано з
  `docs/course/agentic-engineering-course/playbook/skills/sdlc-task-packages`
  для порівняльного прогону в лекції 6.7 (текст завдання називає цю
  хвильову механіку іменем `break-tasks`, але дослівно описує
  `sdlc-task-packages` — плутанина в самому курсі, зафіксована в
  `docs/JOURNAL.md`).
triggers:
  - /tasks-forge
stage: "13"
---

# Skill: tasks-forge (особиста версія sdlc-task-packages / break-tasks)

Той самий end-to-end прохід, що курсовий `sdlc-task-packages`: Stage 1
slicing-пропозиція з обов'язковим `AskUserQuestion`-checkpoint → Stage 2
per-story генерація під 8-gate валідацію (fail → fix, не write) → Stage 3
`_epic.md` + `tracker.md`. Курсовий скіл ніколи не вендорився в
`.claude/skills/`, тож посилатись на дельту, як `sad-forge` →
`architecture-design`, нема на що — цей файл повна копія протоколу з
переписаними дефолтами під практику репо.

## Чому `sdlc-task-packages`, а не `break-tasks`

`docs/course/agentic-engineering-course/sdlc/plugin/skills/break-tasks/` —
простіший, 13 плоских кроків, без хвиль, без 8-gate таблиці, вивід
`docs/features/<slug>/tasks/`. `sdlc-task-packages`
(`playbook/skills/sdlc-task-packages/`) — 3-stage, waves,
`AskUserQuestion`-checkpoint, 8-gate, `delivery/<slug>/tasks/`. Курсовий
текст завдання (Stage 1/2/3, waves, checkpoint, 8-gate, `context_budget
≤5000`) дослівно описує ДРУГИЙ, хоча називає його іменем першого — та сама
плутанина, що в `docs/notes/6-sdlc.md` §6.7. Цей скіл бере протокол
`sdlc-task-packages` як змістову основу (він відповідає тексту завдання),
з виводом у `docs/features/<slug>/tasks/`, як в усіх інших skills цього
репо.

## Owner

Той, хто веде фічу (соло-проєкт — завжди Mike).

## When to use

- «розбий `<slug>` на stories», «task packages для `<slug>`», «task
  breakdown з артефактами».
- Після Stage 12 (impl pack) — тобто після `PRD.md` + `sad.md` §6 +
  `data-model.md` (якщо фіча пише дані) + `contracts/` (якщо є інтерфейс).
- Пропустити, якщо фіча XS (одна історія, паралелізм неможливий) — писати
  `tasks/S-1-<slug>.md` руками.
- Пропустити, якщо `tasks/` уже є і курований вручну; повторний прогін
  перезаписує. `--force` — лише коли нарізка справді змінилась.
- Прогнати знову після зміни скоупу в PRD (новий/викинутий use case) — той
  самий diff-режим, що курсовий: звірити `_generation.md` проти нового
  списку US/AC, запропонувати додавання/видалення story на Stage 1.

## Inputs

- `<slug>` — той самий, що для PRD/SAD/data-model/contracts.
- **Gate (жорстка відмова, якщо нема):** `docs/features/<slug>/PRD.md` §5
  Acceptance criteria (непорожня) і `docs/features/<slug>/sad.md` §6
  Runtime view (≥1 sequence-діаграма). Немає — STOP, назвати відсутній
  артефакт і стадію, що його виробляє (`/spec-forge`, `/sad-forge`).
- **Рекомендовано:** `docs/features/<slug>/data-model.md` (якщо PRD має
  бодай один data-mutating story — інакше gate відмовляє), `contracts/`
  (форма — нижче), ADR-індекс з `docs/features/<slug>/adr/` (посилання за
  ID, тіло ADR ніколи не інлайниться).
- **Ніколи не читати цілком:** кореневий `CLAUDE.md`, секції arc42 поза
  §5/§6, тіла ADR. Завантаження всього дерева суперечить меті скіла —
  story-файли мають лишатись малими.

## Reference-шляхи (не курсовий Go hexagonal-приклад)

Курсовий скіл пише checklist-кроки на кшталт «Define `<Entity>` struct у
`internal/domain/`» — цього шару в репо нема взагалі
(`docs/architecture-map.md`, CLAUDE.md «Правило залежностей»: TS,
`app/lib/{rules,calc,questions,storage,share,format}`, без
domain/infra/ports директорій). Свої дефолти:

| Тип фічі | Де живе код | Приклад з репо |
|---|---|---|
| `worker` (scheduled job, cron-скрипт) | `scripts/<slug>/*.mjs` — плоский pipeline, файл на архітектурне рішення | `scripts/rules-change-monitor/{allowlist,sources,normalize,diff,state,report,cycle}.mjs` |
| продуктова (client-only, `app/lib/**`) | `app/lib/{rules,calc,questions,storage,share,format}/` за шаром | reference-модуль з PRD (напр. `app/lib/rules/types.ts`) |

Checklist-кроки story-файлів називають конкретний файл із цієї таблиці чи
з `sad.md` §5 Будівельні блоки — ніколи вигадану директорію.

## API contract excerpt — читає `events.md` АБО `openapi.yaml`

Курсовий скіл (Stage 2 крок 1) жорстко очікує
`delivery/<slug>/api/openapi.yaml` → `paths:`. Жодна поточна фіча репо не
`backend-service` (`contract-forge` вже зафіксував це рішення) — свій
дефолт читає те, що реально є в `docs/features/<slug>/contracts/`:

| Що лежить у `contracts/` | Excerpt для story |
|---|---|
| `events.md` (`worker`) | `event: <name>` блок + релевантні `data.*` поля, `Idempotency & retry` якщо story торкається retry/dead-letter |
| `cli.md` (`cli`, коли з'явиться) | команда/флаг/exit-code блок |
| `openapi.yaml` (`backend-service`, коли з'явиться) | курсовий формат без змін — `METHOD /path` + request/response |
| нічого (`target_surfaces` не задекларовано, PRD каже «без публічного API») | `_API surface: none — internal story._` |

Story ніколи не отримує `paths:`-заглушку, якої в фічі нема — gate #3
(нижче) явно приймає текстову нотатку `no API surface — internal story`
замість вигаданого ендпоінта.

## Sentinel errors — з реальних доменних полів, не вигаданий реєстр

Курсовий скіл (Stage 2 крок 3, checklist-приклад) каже «Add sentinel
errors per PRD error codes» — у жодній фічі репо немає JSON
error-registry чи `module.error_name`-переліку (той самий висновок, що
`contract-forge` вже зафіксував для контрактів). Свій дефолт: checklist
цитує РЕАЛЬНЕ доменне поле чи патерн:

- Доменне поле стану/причини — `rule_checks.failure_reason`
  (`rules-change-monitor/data-model.md`), `cycle_chat_failures.reason`
  (`tg-assistant/data-model.md`). Значення — текстові категорії
  (`timeout`, `waf_block`, …), не коди з окремого реєстру.
- Процесний патерн — `throw Error` + `process.exit(1)` (`sad.md` §8, тому
  ж патерну слідує наявний прецедент `fetch-zus-benchmark.mjs:137-140`).

Якщо репо колись отримає перший реальний `backend-service`/`events`
контракт із власним error-реєстром — цей розділ переходить на курсовий
формат для ТІЄЇ фічі, не для всіх заднім числом.

## `.size`-based wave-scaling

Курсовий каже «Typical shape is 3 waves; rare cases need 4» без
прив'язки до розміру фічі. Свій дефолт явно зважає на `feature_size`
(frontmatter PRD/SAD) чи `.size`-файл:

| `.size` | Типова кількість хвиль | Чому |
|---|---|---|
| XS | 1 (skip — один story руками, без цього скіла) | Паралелізм неможливий на одному story |
| S | 2-3 | `tg-assistant` (S): 4 хвилі вийшло через строго лінійний пайплайн (§5 «виконуються послідовно») — виняток, не типовий приклад; типова S-фіча без лінійного обмеження вкладається в 2-3 |
| M | 3-4 | `rules-change-monitor` (M): 4 хвилі, реальний паралелізм у хвилі 2 (дві незалежні гілки класифікації) — еталонний приклад цього рядка |
| L/XL | 4+, декомпозиція waves за building-block-групами `sad.md` §5, не за окремими US | Поки жодної фічі репо цього розміру — рядок про запас |

Це орієнтир для Stage 1 пропозиції, не жорсткий ліміт — реальна кількість
хвиль опирається на дійсний граф залежностей (сиквенс-діаграми §6 +
data-model FK-граф), таблиця лише каже, коли варто зупинитись і
перевірити, чи нарізка не роздута штучно.

## Protocol

Той самий каркас, що курсовий (Stage 1 → Stage 2 → Stage 3), з
переписаними деталями під власні дефолти вище. Кроки, де логіка
ідентична, позначені «= курсовий».

### Stage 1 — slicing proposal

1. **Read scope drivers only** (= курсовий): PRD `## 4. User stories` +
   `## 5. Acceptance criteria`; `sad.md` `## 6. Виконання (runtime)`
   заголовки потоків; `data-model.md` Entities (aggregate root на
   сутність, не окрема секція «Aggregate roots» — цей репо тримає це
   інлайн у кожній сутності, `migrations-forge`-формат).
2. **Map US-NN → candidate story** (= курсовий, з одним доповненням): якщо
   `sad.md` §5 прямим текстом описує порядок виконання модулів
   («виконуються послідовно» / інша явна фраза про залежність) —
   нарізка йде по цій фразі буквально, не по здогадці. Якщо один модуль
   (напр. `diff.mjs`) відповідає за кілька станів/гілок із РІЗНИМИ
   реальними залежностями (частина гілок не потребує виводу іншого
   модуля, частина потребує) — нарізка йде **по гілках потоку**, не по
   файлу, і це явно документується в `_generation.md` (не створювати
   ілюзію двох незалежних модулів там, де насправді один файл з
   розгалуженнями).
3. **Propose waves** — розмір-орієнтир із таблиці вище, реальна кількість
   з графа залежностей (FK-граф `data-model.md` + `blocked_by`, що
   випливає з §6). Хвиля без паралелізму (кожна рівно 1 story) — законний
   наслідок лінійного пайплайна, не помилка нарізки; зазначити це явно в
   `_generation.md`, якщо так вийшло.
4. **Write `_generation.md`** (= курсовий формат таблиці: id, title, PRD
   source, sad source, endpoint, wave, rationale) + секція «Ключове
   рішення нарізки» одним-двома абзацами, що називає джерело нарізки
   (буквальна фраза з §5, чи гілки одного файлу) і чесно визнає відсутність
   паралелізму, якщо вона є.
5. **Checkpoint** (= курсовий, обов'язковий, не пропускається): реальний
   `AskUserQuestion` з підсумком «N stories у K хвилях», Accept / Edit
   waves / Reject.
6. **DAG sanity** (= курсовий): цикли, dangling-посилання,
   внутрішньо-хвильова залежність — Stage 1 bug, виправити до Stage 2.

### Stage 2 — per-story generation

1. **Extract excerpts** — сиквенс-лінк (навіть якщо гілка story не
   намальована окремо в §6 — тоді явна нотатка «Missing» з посиланням на
   рядок у власній таблиці покриття §6, а не мовчання), data delta (NEW
   vs DELTA, з `data-model.md`), API contract (таблиця вище — `events.md`
   / `cli.md` / `openapi.yaml` / `none — internal story`), ADR (ID лише).
2. **Map ACs to GWT** (= курсовий): мінімум 2 на story; якщо PRD дає лише
   1 — derived AC із джерела (sequence-крок, чи data-model housekeeping
   поле типу `finished_at`/`status`), позначений derived, не вигаданий
   поза джерелами.
3. **Write checklist** (= курсовий формат, ≤30 хв/крок), з reference-
   шляхами з таблиці вище й sentinel errors з реального доменного поля,
   не з вигаданого реєстру.
4. **Write frontmatter** (= курсовий поля).
5. **8-gate validation** (= курсовий, буквально та сама таблиця — не
   скорочувати, не пропускати вибірково): будь-який fail → fix story, не
   писати файл. Fail, спричинений реальним пропуском покриття (не лише
   формальною кількістю рядків) — задокументувати в `_generation.md`, як
   зразок для наступного прогону.
6. **Write file.**

### Stage 3 — tracker + epic assembly

= курсовий (`_epic.md` з ASCII dependency graph, Progress-checklist,
Waves-таблицею; `tracker.md` flat status). Total завжди читається з
tracker, не хардкодиться.

## Definition of Done

Той самий каркас, що курсовий (Stage 1/2/3 acceptance criteria — див.
курсовий `SKILL.md`, тут не дублюється), плюс:
- Вивід у `docs/features/<slug>/tasks/`, не `delivery/<slug>/tasks/`.
- Жоден checklist-крок не називає директорію, якої в репо нема
  (`internal/`, `domain/`, `ports/`) — лише реальні шляхи з таблиці вище
  чи `sad.md` §5.
- Жоден API contract excerpt не вигадує `paths:`, якого нема — або
  реальний excerpt з наявного `contracts/`-файлу, або явне `none —
  internal story`.
- Жоден sentinel error не посилається на реєстр, якого в фічі нема.

## Anti-patterns

Той самий список, що курсовий (inline повний sequence diagram/ADR/ER-
таблицю в story, waves зі story-to-story залежністю всередині хвилі,
вигадані AC, пропущений Stage 1 checkpoint, hardcoded totals в `_epic.md`,
код конкретної мови в checklist), плюс:
- **Копіювати курсовий `delivery/<slug>/tasks/` шлях мовчки.** Того
  кореня в цьому репо нема — вивід завжди `docs/features/<slug>/tasks/`.
- **Писати checklist-крок із вигаданою директорією** (`internal/domain/`,
  `ports/`) замість реального шляху з таблиці Reference-шляхи.
- **Вимагати `openapi.yaml` там, де фіча має `events.md` чи взагалі не
  має інтерфейсу.** Gate #3 приймає обидві форми контракту й explicit
  «none — internal story».
- **Форсувати «typical 3 waves» коли реальний граф залежностей інший.**
  `.size`-таблиця — орієнтир для Stage 1 пропозиції, не привід ігнорувати
  дійсні `blocked_by`-залежності з §6/data-model.

## Templates

→ [`_templates/_epic.md`](_templates/_epic.md), [`_templates/story.md`](_templates/story.md),
[`_templates/tracker.md`](_templates/tracker.md) — та сама структура, що
курсовий `sdlc-task-packages/_templates/`, з переписаним шляхом
Linked artifacts (reference-шляхи цього репо замість Go-прикладу) і
без курсового `openapi.yaml`-специфічного тексту в коментарях (замінено
на таблицю форм контракту вище).
