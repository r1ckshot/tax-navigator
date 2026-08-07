---
name: migrations-forge
description: >-
  Особиста версія generate-data-model — той самий flow (bootstrap rules →
  читати PRD+sad.md → сутності/індекси з §6 persist-нотаток → data-model.md
  → staged-міграції → self-check → audit-звіт), але під практику цього репо,
  не курсові Postgres-дефолти: (1) **SQLite, не Postgres** — цільова БД
  однакова з філософією локальних інструментів репо (JSON-стан, sessionStorage,
  нуль серверної інфраструктури); (2) **власний migrate-раннер на node:sqlite**
  замість golang-migrate/Alembic/Liquibase — жодного з них у репо нема, і
  додавати новий npm/системний пакет заради навчальної вправи суперечить
  «нуль залежностей» духу `app/lib/calc/`; (3) **contract-фаза breaking change
  завжди table-rebuild**, не `ALTER COLUMN SET NOT NULL` — SQLite такого
  синтаксису не підтримує взагалі (підтверджено живим roundtrip-тестом на
  `rules-change-monitor`, 2026-08-07); (4) типи під SQLite type affinity
  (`TEXT`/`INTEGER`, не `UUID`/`TIMESTAMPTZ`/`BOOLEAN`). Standalone, не
  прив'язаний до жодної фічі. Тригери: «/migrations-forge <slug>», «модель
  даних через migrations-forge для <slug>». Адаптовано з
  `docs/course/agentic-engineering-course/sdlc/plugin/skills/generate-data-model`
  для порівняльного прогону в лекції 6.5.
triggers:
  - /migrations-forge
stage: "07"
---

# Skill: migrations-forge (особиста версія generate-data-model)

Той самий end-to-end прохід, що курсовий `generate-data-model`: data model +
staged-міграції + drift-звірка за один прогін. Цей файл — повна копія
(курсовий скіл ніколи не вендорився в `.claude/skills/`, тож посилатись на
дельту, як `sad-forge` → `architecture-design`, нема на що) з переписаними
дефолтами й доданим migrate-раннером.

## Чому SQLite, а не Postgres

Курсовий скіл свідомо «course-opinionated, не detected» — Postgres-типи
(`UUID`, `TIMESTAMPTZ`, `now()`) незалежно від того, що каже репо. Це
чесний вибір для курсу, але для практики цього репо — ні:

- `docs/architecture-map.md` §Сховища даних: «БД — Немає». Продукт client-only,
  `DATABASE_URL` у `.env.example` позначений як невикористовуваний.
- Дві фічі, що реально моделюють постійне сховище (`tg-assistant`,
  `rules-change-monitor`), обидві ADR-driven обрали **JSON-файл**, не БД
  (ADR-0003 / ADR-0002) — соло-скрипти без сервера, без потреби в
  клієнт-серверному РСУБД.
- Якщо колись знадобиться queryable сховище понад JSON — природний наступний
  крок для соло-локального інструмента саме SQLite: файл на диску, нуль
  окремого процесу, той самий деплоймент-профіль, що вже є (`worker`/`cli`
  без інфраструктури, `sad-forge` §5 «рекомендовані контейнери»).

Postgres-специфіка курсового скіла (`CREATE INDEX CONCURRENTLY`,
`ALTER COLUMN SET NOT NULL`) для SQLite не просто «інший синтаксис» — цих
можливостей у SQLite **немає взагалі**. Живий roundtrip-тест 2026-08-07
(`docs/features/rules-change-monitor/_audit/data-model-2026-08-07.md`)
це підтвердив: contract-фазу довелось вручну перекладати на table-rebuild,
бо `ALTER COLUMN` не спрацював. Цей скіл одразу генерує правильний патерн,
не змушує це виявляти постфактум.

## Owner

Той, хто веде фічу (соло-проєкт — завжди Mike).

## When to use

- «модель даних для `<slug>`», «схема для `<slug>`», «згенеруй міграції для `<slug>`».
- Після `PRD.md` + `sad.md` §6 (критичні потоки з persist-нотатками) — так
  само, як курсовий скіл: спершу `complete-sequence-diagrams`, тоді цей.
- `/migrations-forge <slug> --mode brownfield` — дельта проти вже застосованих
  міграцій (парсить `schema_migrations` + існуючі `.up.sql`, офлайн).
- `/migrations-forge <slug> --drift-only` — лише звірка домену проти моделі.
- Пропустити, якщо `data-model.md` уже є і кожна сутність має пару
  staged-файлів.

## Inputs

- `<slug>` — той самий, що для PRD/SAD.
- **Gate (жорстка відмова, якщо нема):** `docs/features/<slug>/PRD.md` +
  `docs/features/<slug>/sad.md`. Немає — STOP, вказати `/sdlc-write-prd` чи
  `/sad-forge <slug>`.
- Опційно: `sad.md` §6 (потоки complete-sequence-diagrams) — кожна нотатка
  `persists <entity>` → кандидат на індекс.
- Опційно: `docs/architecture-map.md` §Сховища даних — джерело правди «чи
  взагалі є БД у цьому репо» (зазвичай ні — тоді це навчальний прогін, як і
  зараз).

## Defaults (власні, під практику цього репо — НЕ курсові)

| Тема | Курсовий дефолт | Дефолт цього скіла | Чому |
|---|---|---|---|
| Рушій | Postgres | **SQLite** (файл `*.db`) | Немає серверної БД у репо взагалі; SQLite — природний наступний крок для соло-локального `worker`/`cli` |
| Ідентифікатор файлу міграції | `<ts>_<verb>_<entity>.up.sql` | **той самий** | Дві паралельні гілки не зіткнуться — це не Postgres-специфіка, лишаю як є |
| Ідемпотентність DDL | `IF NOT EXISTS` | **той самий** | SQLite підтримує `CREATE TABLE/INDEX IF NOT EXISTS` нативно |
| PK | `UUID` тип, генерується в коді | `TEXT` тип (UUID v7 як рядок), генерується в коді | SQLite не має нативного типу UUID — зберігається як текст, стратегія генерації та сама |
| Timestamp | `TIMESTAMPTZ NOT NULL DEFAULT now()` | `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))` | SQLite не має `TIMESTAMPTZ`/`now()`; ISO-8601 рядок — ідіома SQLite, сортується лексикографічно так само, як хронологічно |
| Boolean | `BOOLEAN` | `INTEGER` (0/1) | SQLite не має нативного BOOLEAN — type affinity зводить його до INTEGER так чи інакше, роблю це явним |
| Аудит-колонки | лише `created_at` | **той самий** | Immutable-first — репо-незалежне рішення, узгоджуюсь з курсом |
| Delete-стратегія | hard delete | **той самий** | Узгоджуюсь — немає причини для soft delete в жодній фічі цього репо |
| Індекси на існуючій таблиці | `CREATE INDEX CONCURRENTLY` | `CREATE INDEX` (без `CONCURRENTLY`) | SQLite блокує запис на весь час `CREATE INDEX` незалежно від синтаксису — `CONCURRENTLY` там не існує й нічого не рятує; компенсація — запускати міграції у вікно з низьким навантаженням (соло-інструмент, це й так завжди так) |
| Рядки | `VARCHAR(N)` / `TEXT` | **`TEXT` завжди** | SQLite ігнорує `N` в `VARCHAR(N)` (type affinity, довжина не форситься на рівні руш) — писати `VARCHAR(200)` було б брехнею про гарантію, якої СУБД не дає; межу валідує app-код (той самий принцип, що zod/валідація форми в `app/lib/questions`) |
| Breaking change (rename/NOT NULL) | expand → backfill → contract, contract = `ALTER COLUMN` | expand → backfill → contract, **contract = table-rebuild** (create new → copy → drop old → rename) | `ALTER COLUMN SET/DROP NOT NULL` не існує в SQLite (`ALTER TABLE` там — лише `ADD COLUMN`/`DROP COLUMN`/`RENAME`) |
| Заборонено | `CHECK`, `TRIGGER`, бізнес-`DEFAULT` | **той самий** — плюс явне посилання нижче | БД = тупе сховище; той самий принцип, що межі шарів `app/lib/**` у `CLAUDE.md` («Правило залежностей») — бізнес-логіка живе в одному місці, не розповзається по шарах |
| Seed / PII guard | `example.test` | **той самий** | Узгоджуюсь — репо-незалежна гігієна |

**Заборонений список (CHECK/TRIGGER/бізнес-DEFAULT) — чому саме тут, а не
цитата з CLAUDE.md:** у `CLAUDE.md` цього репо немає окремого розділу про
БД (продукт її не має), тож пряме посилання неможливе. Найближчий чинний
аналог — «Правило залежностей» (шар `calc/` — лише чисті розрахунки, нуль
залежностей, `rules/` — лише дані) і `.claude/rules/product-safety.md`
(розрахунки — тільки на клієнті). Дух той самий: одна точка правди для
бізнес-логіки. Якщо колись БД зʼявиться в репо по-справжньому — цей
список заслуговує власного рядка в `CLAUDE.md`, не лише тут.

## Migration runner — власний, не golang-migrate/Alembic/Liquibase

У репо немає жодного з трьох (перевірено 2026-08-07: `which sqlite3 psql
docker` — порожньо; `node --version` → 22.23.1, має вбудований
`node:sqlite`, experimental). Ставити системний чи Go/Python-раннер заради
навчальної вправи в Node-репо — нова залежність без причини. Референс-раннер
— [`templates/migrate-runner.mjs`](templates/migrate-runner.mjs), копіюється
в проєкт (`scripts/migrate.mjs` чи стек-еквівалент) лише коли фіча реально
доходить до `implement-tasks` — так само, як staged-міграції лишаються
staged, доки фічу не почали будувати.

**Синтаксис:**

```bash
node scripts/migrate.mjs up [--dir docs/features/<slug>/migrations] [--db path/to.db]
node scripts/migrate.mjs down [--steps N] [--dir ...] [--db ...]
node scripts/migrate.mjs status [--dir ...] [--db ...]
```

- Кожен застосований файл трекається в таблиці `schema_migrations (id TEXT
  PRIMARY KEY, applied_at TEXT NOT NULL)` — `id` = ім'я файлу без
  `.up.sql`/`.down.sql`.
- `up` застосовує всі не застосовані `*.up.sql` за алфавітним (=
  хронологічним, бо timestamp-naming) порядком, кожен файл — своя
  транзакція (`BEGIN`/`COMMIT`, SQLite підтримує транзакційний DDL — на
  відміну від Postgres, тут не треба виключати `CREATE INDEX
  CONCURRENTLY` з транзакції, бо `CONCURRENTLY` тут не існує в принципі).
- `down --steps N` відкочує останні N застосованих файлів у зворотному
  порядку, виконуючи відповідний `.down.sql`.
- Немає мережевого підключення — `--db` це шлях до файлу, `:memory:` для
  тестів.

## Protocol

Той самий каркас, що курсовий скіл (кроки 1-16), з переписаними кроками під
власні дефолти. Кроки, де логіка ідентична, позначені «= курсовий».

1. **Prereq gate** (= курсовий). `test -f PRD.md && test -f sad.md`.
2. **Rules bootstrap.** Якщо `.claude/rules/migrations.md` відсутній —
   копіювати [`templates/rules-migrations-baseline.md`](templates/rules-migrations-baseline.md)
   (SQLite-версія, не курсова Postgres). Якщо файл уже є з курсовими
   Postgres-дефолтами (як зараз, з простого рівня цього ж уроку) — **не
   перезаписувати мовчки**: доповнити окремою секцією «SQLite-профіль
   (migrations-forge)» і повідомити користувача, які дефолти розходяться.
3. **Читати architecture-map.md** (= курсовий, borrowed mechanism) — шукати
   §Сховища даних. У цьому репо там прямо написано «Немає»; це не помилка
   вводу, а очікуваний стан — фіксується в audit-звіті, не блокує прогін.
4. **Читати prereqs** (= курсовий порядок: PRD §4/§5 → sad.md ER-нарис (якщо
   є) → sad.md §6 persist-нотатки → домен (якщо є, для drift) →
   (brownfield) наявні `*.up.sql` цієї ж feature-теки).
5. **Aggregate roots** (= курсовий — питати чи виводити з AC).
6. **PK strategy.** UUID v7, тип колонки `TEXT` (не `UUID` — SQLite такого
   типу не має).
7. **Колонки/обмеження** — застосовувати таблицю Defaults вище: `TEXT`
   завжди для рядків (не `VARCHAR(N)`), `INTEGER` для boolean, `TEXT` +
   `strftime` для timestamp. `<!-- TBD -->` де чесно не вирішено.
8. **Індекси на запит** (= курсовий — один на конкретний запит із §6
   persist-нотаток, без «про всяк випадок»). Формула CONCURRENTLY не
   застосовується (SQLite її не має) — просто `CREATE INDEX IF NOT EXISTS`.
9. **Пишу `data-model.md`** з [`templates/data-model.md`](templates/data-model.md)
   (SQLite-версія — типи в ER і таблицях відповідають Defaults). Валідація
   `erDiagram` — той самий структурний лінт, що й курсовий скіл (`_shared/mermaid-check.md`
   курсового плагіна, немає підстав переписувати правила Mermaid-синтаксису).
10. **Генерую staged-міграції** в `docs/features/<slug>/migrations/` (=
    курсовий: НЕ в живе дерево, `implement-tasks` промоутить пізніше). SQL —
    SQLite-flavored: `TEXT`/`INTEGER`, `strftime`, без `CONCURRENTLY`.
11. **Seeds** (= курсовий — bootstrap/lookup/fixtures, PII guard той самий).
12. **Drift detection** (= курсовий механізм, offline-парс).
13. **Breaking changes — 3-крокова декомпозиція, contract = table-rebuild.**
    - Phase 1 (expand): `ALTER TABLE ... ADD COLUMN` nullable — SQLite це
      підтримує напряму.
    - Phase 2 (backfill): ідемпотентний `UPDATE ... WHERE col IS NULL`,
      companion-документ (= курсовий).
    - Phase 3 (contract): **НЕ** `ALTER COLUMN` (не існує в SQLite) —
      `CREATE TABLE <entity>_new (...NOT NULL...)` → `INSERT INTO
      <entity>_new SELECT ... FROM <entity>` → `DROP TABLE <entity>` →
      `ALTER TABLE <entity>_new RENAME TO <entity>` → перестворити індекси
      (вони губляться при `DROP TABLE`). Той самий патерн і для rename/drop
      колонки — SQLite 3.35+ підтримує `RENAME COLUMN`/`DROP COLUMN` напряму
      для простих випадків, table-rebuild потрібен лише коли міняється сам
      constraint (NOT NULL, тип).
14. **Self-check (4 обов'язкові)** — той самий список, що курсовий
    (naming, down/up-симетрія, FK-індекси, заборонені фічі), плюс перевірка
    на `CONCURRENTLY`/`ALTER COLUMN` у будь-якому staged-файлі — обидва
    мають нульові збіги (SQLite-профіль).
15. **Audit-звіт** — той самий формат, що курсовий, плюс обов'язковий рядок
    «рушій: SQLite» і посилання на цю таблицю Defaults для кожного
    відхилення від курсового скіла.
16. **Пропозиція коміту + handoff** — той самий формат.

## Questions for discussion

Той самий список, що курсовий (aggregate roots, `updated_at`-виняток, soft
delete override, «indexes just in case», JSONB confirm, maintenance window
для breaking change) — плюс: чи справді SQLite-файл, чи ця конкретна фіча
таки заслуговує на сервер (питати explicit, не мовчки застосовувати дефолт,
якщо PRD натякає на конкурентний запис із кількох процесів одночасно —
SQLite слабший за Postgres саме тут).

## Definition of Done

Той самий список, що курсовий (`data-model.md` з ER + FK-виправданими
індексами; staged, не live; 4/4 self-check; audit-звіт), плюс:
- Жодного `VARCHAR(N)`, `TIMESTAMPTZ`, `UUID`-типу, `now()`, `CONCURRENTLY`,
  `ALTER COLUMN` у жодному staged-файлі — grep на ці токени чистий.
- Contract-фаза будь-якого breaking change — table-rebuild, не `ALTER COLUMN`.

## Anti-patterns

Той самий список, що курсовий (бізнес-DEFAULT, CHECK/TRIGGER, «про всяк
випадок» індекс, TEXT-для-всього — тут навпаки, дивись Defaults навіщо
TEXT-для-рядків тут навмисний вибір, не лінь, PK із sequence, PII в seeds,
sequential filenames, ORM/DSL, live DB introspection без офлайн-парсу,
мовчазний bootstrap правил), плюс:
- **Писати `ALTER COLUMN` для SQLite.** Синтаксично прийметься лише якщо
  парсер про це не знає — реальний прогін впаде. Завжди table-rebuild.
- **`CREATE INDEX CONCURRENTLY` для SQLite.** Не існує, і не потрібен — SQLite
  й так блокує запис на короткий DDL, `CONCURRENTLY` тут не про що.
- **Мовчки переписати курсовий Postgres-профіль `.claude/rules/migrations.md`
  на SQLite.** Крок 2 явно каже: доповнити секцією, не замінити — обидва
  профілі можуть співіснувати, якщо колись у репо буде і Postgres-фіча, і
  SQLite-фіча.

## Templates

→ [`templates/data-model.md`](templates/data-model.md) — вихідна структура
(SQLite-типи).
→ [`templates/rules-migrations-baseline.md`](templates/rules-migrations-baseline.md)
— базовий `.claude/rules/migrations.md` (SQLite-профіль).
→ [`templates/migrate-runner.mjs`](templates/migrate-runner.mjs) — референс
своєї реалізації раннера на `node:sqlite`.
