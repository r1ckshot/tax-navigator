# Data model audit — rules-change-monitor — 2026-08-07

<!-- Написано протоколом generate-data-model, крок 15 (скіл невендорений, запущено вручну). -->

## Generated files

- `docs/features/rules-change-monitor/data-model.md`
- Staged-міграції (greenfield pass, 3 пари):
  - `20260807130000_create_cycle_runs.{up,down}.sql`
  - `20260807130001_create_rule_checks.{up,down}.sql`
  - `20260807130002_create_veto_entries.{up,down}.sql`

**Staged, не live.** У репо немає живого дерева `migrations/` (`docs/architecture-map.md`
§Сховища даних: «БД — Немає»). Промоут `implement-tasks`-ом — гіпотетичний майбутній крок.

## Convention divergences

- **SQL-first модель проти ADR-0002 (JSON-файл).** `sad.md` §4/§5 свідомо обрали
  `cycle-history.json` + текстовий veto-список замість БД (радіус удару 3/3, чесна
  альтернатива — SQLite, відхилена). Ця модель — навчальний прогін пайплайна уроку 6.5,
  не пропозиція скасувати ADR-0002.
- **Курсовий шаблон очікує `sad.md §6.4` (ER stub)** — структура SAD цього проєкту
  (`sad-forge`) такої підсекції не має; сутності виведено з §5 + §6 (потоки 1-3), як і для
  `tg-assistant` (`_audit/data-model-2026-08-07.md` тієї фічі, той самий запис).
- `.claude/rules/migrations.md` вже існував (забутстрапнено раніше цього ж дня для
  `tg-assistant`) — повторно не перезаписувався.

## Drift findings

- **Schema-vs-source:** пропущено — домену (`scripts/rules-change-monitor/*.mjs`) ще не
  існує, фіча на стадії SAD.
- **Model-vs-spec:** усі 3 таблиці ведуть до конкретних AC (`cycle_runs`←AC-01/09,
  `rule_checks`←AC-01,03,04,05,06,08,09, `veto_entries`←AC-10). Осиротілих таблиць немає.

## Breaking change — `rule_checks.normalized_value`

Після greenfield-проходу свідомо змодельовано другу ітерацію: `rule_checks` отримує
NOT NULL колонку `normalized_value` (ADR-0001 вимагає зберігати нормалізоване значення
окремо від сирого `source_value` для аудиту — у greenfield-моделі це поле пропущено,
виявлено post-hoc). Декомпозовано на expand → backfill → contract (протокол
generate-data-model, крок 13), 3 окремі staged-файли, 3 окремі PR/викочення:

| Фаза | Файл | Що робить |
|---|---|---|
| 1. Expand | `20260807130100_expand_add_normalized_value_to_rule_checks.{up,down}.sql` | `ADD COLUMN` nullable |
| 2. Backfill | `20260807130101_backfill_normalized_value_rule_checks.{up,down}.sql` | ідемпотентний `UPDATE ... WHERE normalized_value IS NULL`; companion — [`backfill-normalized_value.md`](backfill-normalized_value.md) |
| 3. Contract | `20260807130102_contract_set_normalized_value_not_null_on_rule_checks.{up,down}.sql` | `SET NOT NULL` |

**Self-check для цих трьох файлів:**

1. **Naming** — OK. `<timestamp>_<verb>_<entity>` для всіх трьох.
2. **down.sql reversibility** — умовний OK, задокументовано, не мовчки. Expand і
   contract повністю реверсивні (`DROP COLUMN` / `DROP NOT NULL`). Backfill — ні: його
   `.down.sql` навмисний no-op (`SELECT 1`), бо «розбекфілити» дані нема сенсу — відкат
   цієї фази фактично відбувається через `.down.sql` фази 1 (дропає колонку разом із
   даними).
3. **FK indexes** — N/A, ця зміна не додає нового FK.
4. **Forbidden features** — OK (0 збігів `CHECK (`/`CREATE TRIGGER`/`DEFAULT '`).

**Roundtrip-верифікація (локально, `node:sqlite`).** Живого Postgres у контейнері нема
(`sudo`/`apt-get update` заблоковані політикою харнеса). Прогнано `up → down → up` через
`node --experimental-sqlite` з невеликим шаром трансляції Postgres→SQLite (типи
`UUID`/`TIMESTAMPTZ`→`TEXT`, `DEFAULT now()`→`DEFAULT CURRENT_TIMESTAMP`, `IF NOT
EXISTS`/`IF EXISTS` прибрано з `ADD`/`DROP COLUMN` — SQLite їх не підтримує).

Ключова знахідка: `ALTER TABLE ... ALTER COLUMN ... SET/DROP NOT NULL` (contract-фаза) —
синтаксису, якого в SQLite немає взагалі (`ALTER TABLE` там — лише `ADD COLUMN`/`DROP
COLUMN`/`RENAME`). Для тесту цю фазу перекладено вручну на паттерн «нова таблиця → копія
даних → drop старої → rename». Реальний Postgres-деплой використовує staged-файли як є,
без цього шару — переклад існує лише для локальної перевірки в цьому середовищі.

Результат: `up` (6 файлів) застосувався без помилок; `down` (6 файлів у зворотному
порядку) лишив схему порожньою (0 таблиць, 0 індексів); повторний `up` дав схему,
ідентичну першому проходу (звірено текстово через `sqlite_master`).

**Порядок деплою:** Expand → deploy app-код з dual-write → Backfill (доки
`normalized_value IS NULL` не поверне 0 рядків) → підтвердити 0 → Contract. Пропуск
підтвердження між Backfill і Contract — найчастіший спосіб зламати цей патерн.

## TBDs

- `rule_checks.state` — точний список 7 значень (з AC-03) не зафіксовано як `CHECK` (за
  дефолтом — enum живе в коді, `app/lib/rules/types.ts`-подібний файл для цього скрипта
  ще не написаний).

## Self-check (4/4) — greenfield pass (3 файли)

1. **Naming** — OK. `cycle_runs`, `rule_checks`, `veto_entries` — plural snake_case; файли
   `<timestamp>_create_<entity>`.
2. **down.sql reversibility** — OK. Кожен `CREATE TABLE`/`CREATE INDEX` має відповідний
   `DROP` у парному `.down.sql` (перевірено скриптом — 3/3 пари присутні).
3. **FK indexes** — OK. `rule_checks.cycle_id` → `idx_rule_checks_cycle_id`. `veto_entries`
   без FK (свідомо, ручний список).
4. **Forbidden features** — OK, `grep -n "CHECK (\|CREATE TRIGGER\|DEFAULT '" *.sql` — 0 збігів.

## Handoff

**Що зроблено:** `data-model.md` + 3 staged-пари (greenfield) + 3 staged-пари (breaking
change, вище) + цей аудит + roundtrip-верифікація.
**Рев'ю:** `docs/features/rules-change-monitor/data-model.md`, staged
`docs/features/rules-change-monitor/migrations/`.
**Далі:** коміт `04`, тоді власний скіл `migrations-forge`.
