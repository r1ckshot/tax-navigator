---
id: S-1
epic: tg-assistant
project: tax-navigator
wave: 1
priority: Must
estimate: 2d
blocks: [S-2]
blocked_by: []
status: todo
context_budget: ~2200 tokens
created: 2026-08-10
---

# S-1 · Тижневий цикл збору: авторизовані чати, дедуп, backfill, недоступні чати

**Epic:** [[_epic|tg-assistant]]
**Priority:** Must
**Estimate:** 2d
**Wave:** 1

## Місце в послідовності

- **Блокується:** нічим (foundation).
- **Блокує:** S-2 — без зібраних `messages` фільтрувати нічого.
- **Чому в цій хвилі:** перший модуль лінійного пайплайна (`collector.ts` + `state.ts`, sad.md §5) — усі інші модулі читають його вихід.

## Why (user story)

**Як** Дослідник ринку, **я хочу** щоб асистент раз на тиждень безнаглядно обходив чати, де я вже учасник, збирав нові повідомлення, надолужував пропущений тиждень і чесно називав недоступні чати, **щоб** мені не треба проводити протокол збору вручну щоразу і я не втрачав дані через паузу.

Combines US-01 (AC-01, AC-02) + US-05 (AC-08, AC-09, AC-10) — один модуль `collector.ts`/`state.ts` володіє всіма п'ятьма.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: тижневий цикл збору — авторизовані чати, дедуп при надолуженні (AC-01, AC-02, AC-09)]] — Covered: AC-01, AC-02, AC-09; trivial: AC-08 (dead-letter гілка); **Missing:** AC-10 (вікно backfill не деталізоване окремо — потік малює лише «читає нові повідомлення», без розбивки на глибину N тижнів). Чесно позначено в `_generation.md`, не приховано.
- 🗄 Data delta: див. нижче
- 🌐 API contract: `_API surface: none — internal story._`
- 📜 Relevant ADR: [[../adr/0001-direct-mtproto-library-over-interactive-mcp|ADR-0001]] (пряма MTProto-бібліотека), [[../adr/0002-per-chat-backoff-queue-for-flood-wait|ADR-0002]] (backoff-черга), [[../adr/0003-json-file-for-cycle-state|ADR-0003]] (стан циклу — JSON, не SQL)
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
NEW table `chats` (root)
NEW table `messages` (FK chat_id → chats.id)
NEW table `cycle_runs` (root)
NEW table `cycle_chat_failures` (FK cycle_run_id → cycle_runs.id, FK chat_id → chats.id)
Migration files (staged, docs/features/tg-assistant/migrations/):
  20260807120000_create_chats.{up,down}.sql
  20260807120001_create_cycle_runs.{up,down}.sql
  20260807120002_create_messages.{up,down}.sql
  20260807120003_create_cycle_chat_failures.{up,down}.sql
```

**Важливо:** ці SQL-міграції — staged навчальна вправа уроку 6.5
([data-model.md](../data-model.md) header), не джерело істини реального
стораджу. Релізна імплементація тримає стан у `state.json`
([ADR-0003](../adr/0003-json-file-for-cycle-state.md)) — schema вище описує
той самий стан у SQL-термінах для цієї вправи, поля 1:1 мапляться на
JSON-структуру.

## API contract

`_API surface: none — internal story._`

## Acceptance criteria (GWT)

- [ ] **AC-01:** Given дослідник уже учасник обраних чатів, when настає тижневий момент розкладу, then система безнаглядно збирає нові повідомлення з цих чатів і готує їх до розмітки.
- [ ] **AC-02:** Given чат, до якого дослідник ніколи не приєднувався, when цикл формує список чатів для обходу, then система ніколи не включає цей чат і не показує його в звіті.
- [ ] **AC-08:** Given дослідник під час циклу втратив доступ до раніше доступного чату (виключений, чат видалено чи закрито) або читання частини чатів не вдалося, when цикл формує звіт, then система явно називає, до яких чатів доступ втрачено чи не вдалося прочитати, а не показує правдоподібний нуль.
- [ ] **AC-09:** Given попередній цикл пропущено, when наступний цикл запускається, then він надолужує пропущений тиждень, не дублюючи вже зібрані раніше питання.
- [ ] **AC-10:** Given дослідник щойно приєднався до нового чату з історією довшою за N тижнів, when наступний цикл обробляє цей чат, then система підтягує лише останні N тижнів історії і явно позначає межу вікна в звіті, не заглиблюючись автоматично далі.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Реалізувати `collector.ts`: MTProto-читання нових повідомлень чату з позначки останнього тижня (ADR-0001), лише для чатів зі списку `chats` — AC-02 гейтиться на рівні запиту (чужий чат фізично відсутній у таблиці).
- [ ] Step 2 — Додати чергу по чатах з експоненційним backoff, що читає конкретне значення X із `FLOOD_WAIT_X` (ADR-0002); при вичерпаних ретраях (3 поспіль) писати рядок у `cycle_chat_failures.reason` замість тихого нуля (AC-08).
- [x] Step 3 — Реалізувати `state.ts`: ключ ідемпотентності `cycle_runs.week_of`, дедуп нового повідомлення проти вже зібраних через UNIQUE(`chat_id`, `telegram_message_id`) — повторний прогін циклу для того самого тижня не дублює (AC-09). Скриптовано: `research/tg-assistant/state.ts` + `state.test.ts` (8 тестів), скоуплені `vitest.config.ts`/`tsconfig.json` (лекція 7.3, /goal).
- [ ] Step 4 — Для чату з `chats.created_at` новішим за N тижнів (конфігурований дефолт — PRD §8 відкрите питання, зараз 4) обмежити глибину читання вікном N тижнів і явно позначити межу вікна в даних, що підуть у звіт (AC-10).
- [x] Step 5 — Прогнати staged-міграції `migrations/` проти живого `node:sqlite` (roundtrip up→down→up, як на `rules-change-monitor` — `_audit/data-model-2026-08-07.md`) і звірити з `data-model.md` Entities. Скриптовано: `scripts/verify-tg-assistant-migrations.mjs` + `scripts/test-verify-tg-assistant-migrations.sh` (лекція 7.2, Ralph loop).

## Edge cases (optional)

| Кейс | Поведінка |
|---|---|
| Telegram `FLOOD_WAIT_X` посеред циклу для конкретного чату | Пауза й backoff лише для цього чату (ADR-0002); решта чатів обробляються далі в тому самому прогоні |
| Дослідника виключили з чату між тижневими циклами | `cycle_chat_failures.reason = "access_lost"`; чат зникає зі списку collection наступного тижня, а не падає з помилкою всього циклу |

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] AC-09 anti-regression: повторний прогін циклу для того самого `week_of` не створює других `messages`-рядків — `UNIQUE(chat_id, telegram_message_id)` ловить дубль на catch-up.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-1-tg-assistant.md`).
- [ ] `tracker.md` оновлено: status `done`.
