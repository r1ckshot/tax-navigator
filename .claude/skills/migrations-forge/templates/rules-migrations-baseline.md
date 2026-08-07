# Migration rules — SQLite baseline (migrations-forge)

<!-- Bootstrapped by migrations-forge. Edit freely.
Якщо в цьому файлі вже є курсовий Postgres-профіль (з generate-data-model,
простий рівень уроку 6.5) — цей блок ДОПОВНЮЄ його як окрема секція, не
замінює. Обидва профілі можуть співіснувати. -->

## SQLite-профіль (migrations-forge)

### Рушій

SQLite, файл на диску. Немає серверної БД у репо (`docs/architecture-map.md`
§Сховища даних: «Немає») — це природний наступний крок для соло-локального
`worker`/`cli`-інструмента, не клієнт-серверна СУБД.

### Filenames

- Формат: `<YYYYMMDDhhmmss>_<verb>_<entity>.up.sql` + пара `.down.sql`.
- Той самий, що курсовий профіль — timestamp-naming не Postgres-специфіка.

### Жорсткі правила (БД як тупе сховище)

- Без `CHECK` на бізнес-інваріанти.
- Без `CREATE TRIGGER`.
- Без `DEFAULT '<бізнесове значення>'` (лише `DEFAULT (strftime(...))` для
  timestamp).
- Без stored procedures (SQLite їх і не підтримує).
- Бізнес-логіка живе в коді застосунку.

### Обов'язкові вимоги

- Кожен `REFERENCES other_table(id)` має `CREATE INDEX` на FK-колонку.
- Кожен `.up.sql` має пару `.down.sql`, що повністю реверсує (окрім
  data-only backfill-фаз — там `.down.sql` документовано no-op, дивись
  SKILL.md крок 13).
- `CREATE TABLE`/`CREATE INDEX` — з `IF NOT EXISTS`.
- Seed `INSERT` — з `ON CONFLICT DO NOTHING`.

### Дефолти (типи — SQLite type affinity, не Postgres-типи)

- PK: `TEXT` (UUID v7 як рядок, генерується в коді застосунку — SQLite не
  має нативного типу UUID).
- Timestamps: `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
  (ISO-8601 рядок — SQLite не має `TIMESTAMPTZ`/`now()`; лексикографічне
  сортування = хронологічне).
- Boolean: `INTEGER` (0/1) — SQLite не має нативного `BOOLEAN`.
- Рядки: **завжди `TEXT`**, ніколи `VARCHAR(N)` — SQLite ігнорує довжину в
  дужках (type affinity, не форситься на рівні рушія); межу перевіряє
  app-код.
- Soft delete: НЕ використовується. Hard delete + audit-таблиця, якщо треба
  історія.
- Аудит-колонки: лише `created_at`. `updated_at` — опційно, лише коли
  сутність справді мутабельна і PRD цього прямо вимагає.
- Naming: `plural_snake_case` таблиці, `snake_case` колонки.
- JSONB → немає в SQLite; для опаку payload — `TEXT` з JSON-рядком,
  парситься в коді застосунку (`JSON.parse`/`JSON.stringify`, без
  SQLite JSON1-функцій, доки немає конкретної потреби в них).

### Zero-downtime патерни (обов'язково для існуючих таблиць)

- Новий NOT NULL стовпець → 3 кроки (nullable → backfill → contract).
- **Contract-фаза breaking change — ЗАВЖДИ table-rebuild, ніколи
  `ALTER COLUMN`.** SQLite не підтримує зміну constraint існуючої колонки
  (`ALTER TABLE` там лише `ADD COLUMN`/`DROP COLUMN`/`RENAME
  TABLE`/`RENAME COLUMN`). Патерн: `CREATE TABLE <entity>_new` з потрібним
  constraint → `INSERT INTO <entity>_new SELECT ... FROM <entity>` →
  `DROP TABLE <entity>` → `ALTER TABLE <entity>_new RENAME TO <entity>` →
  перестворити індекси (губляться разом зі старою таблицею).
- Новий індекс на існуючій таблиці → звичайний `CREATE INDEX IF NOT EXISTS`
  (без `CONCURRENTLY` — SQLite цього не має, і не потребує: короткий DDL
  блокує запис на мілісекунди, не на час індексації великої таблиці, як у
  Postgres).

### Seeds

- **Bootstrap** — детермінований UUID v7 (текстовий рядок) у файлі міграції.
- **Lookup** — окрема міграція, `INSERT ... ON CONFLICT DO NOTHING`.
- **Test fixtures** — НЕ в `migrations/`. Фабрики в тестовій теці проєкту
  (`vitest` — цей репо вже так тестує `app/lib/**`).
- **PII guard**: `admin@example.test`, `user-<uuid>@example.test`, `Test User`.

### Поза межами

- Реплікація, шардинг — SQLite для соло-інструмента однопроцесний за
  визначенням.
- Партиціювання, матеріалізовані view — SQLite їх не підтримує; якщо обсяг
  колись це виправдає, це вже аргумент на користь Postgres, окреме ADR.
