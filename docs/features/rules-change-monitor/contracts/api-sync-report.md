# API contract sync report — rules-change-monitor

<!-- Написано протоколом api-forge, крок 7 (скіл невендорений, запущено вручну). -->

## Interface kind determination

- `sad.md` frontmatter `target_surfaces: ["worker"]` — задекларовано `architecture-design`
  (§4: «Scheduled job без request/response і без UI»). Читаю, не передеривовую.
- Worker → форма контракту `contracts/events.md` (без request/response), за таблицею
  `_shared/surfaces.md`.
- Scenario: **A** — `data-model.md` існує, кожне поле трасується до колонки.

## Section A — field-origins table

| schema_path | origin | confidence |
|---|---|---|
| `cycle.data.id` | `data-model.md` → `cycle_runs.id` (UUID PK) | high |
| `cycle.data.month` | `data-model.md` → `cycle_runs.month` (VARCHAR(7), UNIQUE) | high |
| `cycle.data.status` | `data-model.md` → `cycle_runs.status` (VARCHAR(32)) | high |
| `cycle.data.started_at` | `data-model.md` → `cycle_runs.started_at` | high |
| `cycle.data.finished_at` | `data-model.md` → `cycle_runs.finished_at` (NULL, доки не завершено) | high |
| `rule_check.data.id` | `data-model.md` → `rule_checks.id` (UUID PK) | high |
| `rule_check.data.cycle_id` | `data-model.md` → `rule_checks.cycle_id` (FK) | high |
| `rule_check.data.rule_id` | `data-model.md` → `rule_checks.rule_id` (VARCHAR(64)) | high |
| `rule_check.data.state` | `data-model.md` → `rule_checks.state` (VARCHAR(32), 7-value AC-03) | high |
| `rule_check.data.source_value` | `data-model.md` → `rule_checks.source_value` (TEXT, NULL) | high |
| `rule_check.data.matrix_value` | `data-model.md` → `rule_checks.matrix_value` (TEXT NOT NULL) | high |
| `rule_check.data.failure_reason` | `data-model.md` → `rule_checks.failure_reason` (VARCHAR(255), NULL, AC-08) | high |
| `rule_check.data.diff_percent` | `data-model.md` → `rule_checks.diff_percent` (NUMERIC(6,2), NULL) — додано в `--reconcile` 2026-08-10 | high |
| `*.event_id/event_type/version/occurred_at` | derived (envelope convention, api-forge Defaults) | high |

13/13 полів даних мають `high`-впевненість — `data-model.md` існує і покриває кожне.

## Section B — drift findings (4-point checklist)

1. **Event ↔ data-model** *(core)* — ✓. Кожне поле обох подій трасується до колонки
   `cycle_runs`/`rule_checks` (таблиця вище) або є envelope-конвенцією.
2. **Error code ↔ repo error definition** *(core)* — ✓ N/A. У worker-поверхні немає
   request/response envelope, тож немає `{code, message, details?}` для звірки.
   `rule_checks.failure_reason` — доменне поле даних (AC-08), не запис у реєстрі кодів
   помилок. Позначено явно, не мовчки пропущено.
3. **Validation ↔ constraint** *(core)* — ✓. `rule_id` ≤64, `state` ≤32, `month` UNIQUE —
   межі з `data-model.md` перенесено дослівно.
4. **Events ↔ sequence** *(supporting)* — ✓. `cycle.v1` ← Потік 1 (`Cycle->>Report`);
   `rule_check.v1` ← Потік 1 (`Cycle->>Diff`) + Потік 3 (класифікація). Retry-семантика
   (Idempotency & retry в `events.md`) ← Потік 2 дослівно.

Core-пункти 1-3 — ✓, supporting 4 — ✓. Жодного блокуючого прапорця.

## Back-feed coverage cross-check

- Кожен AC §5 PRD → ≥1 подія чи явно прийняте виключення:
  - AC-01, AC-06 → `cycle.v1` (happy path, звіт).
  - AC-03, AC-04, AC-05, AC-07, AC-08, AC-09 → `rule_check.v1` (`state`/`failure_reason`
    + Idempotency & retry).
  - **AC-02 (allowlist), AC-10 (veto)** → немає окремої події. Обидва — внутрішня
    класифікація в межах Потоку 3, результат лягає в те саме поле `rule_check.data.state`
    («поза автозвіркою», «потребує підтвердження»), не в окрему подію. **Accept-as-is**:
    задокументовано тут, а не прихована прогалина.
- Кожна подія → ≥1 user story + AC: обидві покрито вище.
- Кожна `alt`-гілка Потоку 3 → значення `state`, не окрема відповідь (worker без
  response-конверта). Точний список усіх 7 значень `state` — досі TBD (перенесено з
  `_audit/data-model-2026-08-07.md`: «`rule_checks.state` — точний список 7 значень не
  зафіксовано»); ця прогалина не нова, лише повторно спливає тут.

## Section C — unresolved_origins

Порожньо (scenario A).

## Reconcile — 2026-08-10

Симуляція навмисного розходження: у `data-model.md` додано `rule_checks.diff_percent`
(NUMERIC(6,2), NULL — наскільки джерело відрізняється від матриці, AC-04/05), поки
контракт (`events.md`) про нього ще не знав.

Прогін `--reconcile`:

1. Пере-прочитав усі інпути.
2. Виявив нове поле в `data-model.md`, якого немає в `rule_check.v1` — реальний drift,
   не застаріла неповнота (сценарій весь час був A, поле саме зʼявилось у моделі).
3. Додав `data.diff_percent` (опційне) в `rule_check.v1` у `events.md`, оновив
   `Backwards-compat policy` нотаткою про додавання.
4. Оновив Section A тут (новий рядок, `high` — колонка вже типізована в моделі).
5. `event_type`/`version` **не** зачепив — додавання опційного поля сумісне в межах
   `v1` (additive-only policy), бампу немає, як і задокументовано в `SKILL.md`
   («`info.version` ніколи не бампається мовчки»).

Результат: 0 unresolved, 0 конфліктів — модель і контракт знову синхронні.

## Codegen

Хард-рівень уроку очікує прогін codegen (`oapi-codegen`/`openapi-typescript`) на
`openapi.yaml`. Для `worker`-поверхні цього файлу немає в принципі — HTTP-контракту
нема, генерувати нема з чого. Замість codegen: навмисне розходження і фікс робляться
прямо в `data-model.md` → `--reconcile` (нижче), той самий цикл «зламав-побачив-виправив»,
без HTTP-специфічного інструменту.

---

## ✅ api-forge — rules-change-monitor

**What I did**
- Визначив вид інтерфейсу (`target_surfaces: ["worker"]`, задекларовано `architecture-design`,
  прочитано, не передеривовано) → форма контракту `contracts/events.md`.
- Написав `contracts/events.md` (2 events: `cycle.v1`, `rule_check.v1`) — сценарій A,
  усі поля трасуються до `data-model.md`.
- Прогнав inline drift-check (обидва напрями) і записав цей звіт — 3/3 core ✓, 1/1
  supporting ✓, 0 unresolved_origins, 2 задокументовані Accept-as-is (AC-02/AC-10).

**Review before continuing**
- `docs/features/rules-change-monitor/contracts/events.md` — контракт подій
- `docs/features/rules-change-monitor/contracts/api-sync-report.md` — цей звіт

**Run next**
1. `/clear`
2. `/sdlc-break-tasks rules-change-monitor`
