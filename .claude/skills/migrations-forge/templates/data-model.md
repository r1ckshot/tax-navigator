---
status: Draft
owner: "<ім'я>"
reviewers: []
updated_at: "<YYYY-MM-DD>"
feature_size: "<з .size>"
stage: "07"
ticket: "<ticket-id>"
---

# Data model — <slug>

<!-- Згенеровано migrations-forge. Міграції — STAGED у docs/features/<slug>/migrations/
(НЕ живе дерево — implement-tasks промоутить їх, коли фіча реально будується).
Рушій: SQLite (не Postgres — docs/architecture-map.md §Сховища даних: «Немає»,
цей data-model.md — гіпотетичний навчальний прохід, якщо для фічі не задокументовано
інакше). -->

## ER diagram

<!-- instruction: чиста, вручну впорядкована erDiagram. Один блок, без авто-layout.
Валідувати структурним лінтом (mermaid-check.md) до коміту. Типи атрибутів — SQLite
type affinity: text/integer, НЕ varchar/uuid/timestamptz/boolean. -->

```mermaid
erDiagram
    USER ||--o{ <ENTITY> : has
    <ENTITY> {
        text id PK
        text name
        text created_at
    }
```

## Entities

<!-- instruction: одна підсекція на сутність, згрупована по aggregate root.
Дефолти цього скіла: PK — text (UUID v7 як рядок, генерується в коді); лише
created_at (без updated_at, доки сутність справді мутабельна й PRD цього не
вимагає); hard delete (без deleted_at); TEXT для всіх рядків (не varchar(N) —
SQLite ігнорує довжину); INTEGER (0/1) для boolean; ЖОДНОГО CHECK/TRIGGER/
бізнес-DEFAULT — лише UNIQUE/NOT NULL/FK/DEFAULT (strftime(...))/індекси. -->

### `<entity>`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | TEXT | PK, генерується в коді (UUID v7) | |
| `<col>` | TEXT | NOT NULL | межу довжини перевіряє app-код, не СУБД |
| `<fk>_id` | TEXT | NOT NULL, FK → `<other>(id)` | індексовано нижче |
| `created_at` | TEXT | NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) | ISO-8601, лексикографічне сортування = хронологічне |

**Aggregate root:** <яка сутність володіє цією, або "root">.
**Access patterns:** <конкретний запит> → індекс `<idx_name>` на `<columns>`.
**Constraints:** UNIQUE на `<...>`; FK → `<other>(id)`.

<!-- Why: бізнес-логіка живе в коді, не в БД. Лише UNIQUE/NOT NULL/FK/DEFAULT
(strftime(...))/індекси. -->

## Indexes

<!-- instruction: один рядок на індекс, кожен виправданий конкретним запитом із
sequence-діаграми. Без «про всяк випадок». CONCURRENTLY не застосовується — SQLite
його не має (короткий DDL, не потребує). -->

| Index | Columns | Query it serves |
|---|---|---|
| `<idx_1>` | `<cols>` | <запит/AC, що потребує цей індекс> |

## Test fixtures

<!-- instruction: фабрики, згенеровані для тестів, у формі, яку використовує репо
(vitest — factory-функції). НЕ в migrations/. PII guard: лише example.test. -->

- `<newEntity>(...)` — <що будує>.

## Breaking changes (якщо є)

<!-- instruction: якщо ця модель включає rename/NOT NULL/drop на існуючій таблиці —
3 фази, contract = table-rebuild (не ALTER COLUMN — SQLite його не підтримує). -->

<!-- N/A: greenfield, немає існуючих таблиць для зміни -->
