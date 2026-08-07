# Data model audit — tg-assistant — 2026-08-07

<!-- Написано протоколом generate-data-model, крок 15 (скіл невендорений, запущено вручну). -->

## Generated files

- `docs/features/tg-assistant/data-model.md`
- Staged-міграції (5 пар, `docs/features/tg-assistant/migrations/`):
  - `20260807120000_create_chats.{up,down}.sql`
  - `20260807120001_create_cycle_runs.{up,down}.sql`
  - `20260807120002_create_messages.{up,down}.sql`
  - `20260807120003_create_cycle_chat_failures.{up,down}.sql`
  - `20260807120004_create_question_labels.{up,down}.sql`

**Staged, не live.** У репо взагалі немає живого дерева `migrations/` (`docs/architecture-map.md`
§Сховища даних: «БД — Немає», `.env.example` тримає `DATABASE_URL` неактивним). Промоут
`implement-tasks`-ом — гіпотетичний майбутній крок, не готовий до виконання зараз.

## Convention divergences

- **Курсовий шаблон очікує `sad.md §6.4` (ER stub)** — у структурі SAD цього проєкту
  (`sad-forge`, 12 секцій arc42) немає підсекції §6.4 і взагалі немає окремої ER-секції в
  `sad.md` — ER живе лише в `data-model.md` (за задумом курсу, урок 6.5: «erDiagram
  (data-model.md, 6.5)», `docs/notes/6-sdlc.md:105`). Сутності виведено з §5 (building
  blocks) + persist-нотаток нового потоку §6, а не з неіснуючого §6.4.
- **generate-data-model — SQL-first, ADR-0003 цієї фічі — JSON-файл.** `sad.md` §5/§8
  свідомо обрали `state.json` (дедуп, catch-up, TTL) замість БД. Ця модель — навчальний
  прогін пайплайна, не пропозиція скасувати ADR-0003.
- **`.claude/rules/migrations.md` не існував — бутстрапнуто** з `templates/rules-migrations-baseline.md`
  дослівно, плюс дописано секцію «Контекст цього репо» (нема в курсовому шаблоні) з
  посиланням на `architecture-map.md`.
- Дефолти репо (naming конвенції з `CLAUDE.md`) курсові SQL-конвенції не зачіпають — у
  проєкті взагалі немає SQL-шару, конфлікту немає.

## Drift findings

- **Schema-vs-source:** пропущено — доменного шару (`research/tg-assistant/*.ts`) ще не
  існує, фіча на стадії SAD, не імплементації.
- **Model-vs-spec:** усі сутності PRD §4/§5 мають таблицю —
  - `chats` ← US-01 (список чатів), AC-02 (гейт).
  - `messages` ← US-01/AC-01, US-02/AC-03,04.
  - `question_labels` ← US-03/AC-05,06.
  - `cycle_runs` + `cycle_chat_failures` ← US-05/AC-08,09.
  Осиротілих таблиць немає (кожна веде до конкретного US/AC). `AC-10` (catch-up вікно N
  тижнів для нового чату) не має власного поля — це логіка застосунку над `chats.created_at`
  + конфіг `N`, не окрема колонка; позначено TBD нижче.

## Breaking changes decomposed

Немає — greenfield (перший прохід моделі для цієї фічі).

## TBDs

- `data-model.md`, `cycle_runs.status`: значення enum-in-app (`completed`/`partial`) не
  верифіковані проти PRD §6 NFR — PRD не деталізує проміжні статуси, взято мінімальний
  набір з AC-08.
- Механізм AC-10 (вікно N тижнів для нового чату) — де саме зберігається `N` (конфіг
  застосунку чи колонка) не вирішено, TBD до `implement-tasks`.

## Self-check (4/4 — деталі нижче)

1. **Naming** — OK. Усі таблиці `plural_snake_case`; усі файли `<timestamp>_<verb>_<entity>`.
2. **down.sql reversibility** — OK. Кожен `CREATE TABLE` має `DROP TABLE`; кожен `CREATE INDEX`
   (2 явних: `idx_messages_chat_week`, обидва `cycle_chat_failures`) — свій `DROP INDEX` перед
   `DROP TABLE` у відповідному `.down.sql`.
3. **FK indexes** — OK. `messages.chat_id` — провідна колонка `idx_messages_chat_week`;
   `cycle_chat_failures.cycle_run_id`/`.chat_id` — явні індекси; `question_labels.message_id`
   — покрито імпліцитним індексом `UNIQUE(message_id)` (окремий `CREATE INDEX` прибрано як
   дубль після першого чорнового проходу — див. правку нижче).
4. **Forbidden features** — OK, `grep -n "CHECK (\|CREATE TRIGGER\|DEFAULT '" *.sql` — 0 збігів.

**Знахідка під час self-check:** перший чорновик `question_labels` мав окремий
`CREATE INDEX idx_question_labels_message_id` поверх `UNIQUE(message_id)` — той самий
btree-індекс двічі. Виправлено до фіналу (прибрано явний `CREATE INDEX`, `data-model.md`
таблиця індексів synced). Той самий self-check, що мав це зловити при реальному прогоні
скіла — зловив, коли я його виконував вручну.

## Handoff

**Що зроблено:** `data-model.md` + 5 staged-пар міграцій + цей аудит.
**Рев'ю:** `docs/features/tg-assistant/data-model.md`, staged `docs/features/tg-assistant/migrations/`.
**Далі:** `/clear`, потім `/sdlc-api-forge tg-assistant` (поза межами цього уроку).
