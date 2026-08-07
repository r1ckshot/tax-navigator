# Migration rules — baseline

<!-- Bootstrapped by generate-data-model (skill uninstalled, run manually per SKILL.md protocol — 2026-08-07). -->
<!-- These rules are an opinionated default — see "Defaults" in SKILL.md. -->

## Filenames

- Format: `<YYYYMMDDhhmmss>_<verb>_<entity>.up.sql` + matching `.down.sql`.
- Reason: parallel feature branches do not collide on the next sequential number.

## Hard rules (DB as dumb storage)

- No `CHECK` constraints on business invariants.
- No `CREATE TRIGGER`.
- No `DEFAULT '<business literal>'` (only `DEFAULT now()` for timestamps).
- No stored procedures.
- Business logic lives in app code.

## Required constraints

- Every `REFERENCES other_table(id)` is followed by `CREATE INDEX` on the FK column (same or next migration).
- Every `.up.sql` has a matching `.down.sql` that fully reverses it.
- `CREATE TABLE` / `CREATE INDEX` use `IF NOT EXISTS`.
- Seed `INSERT` uses `ON CONFLICT DO NOTHING`.

## Defaults

- PK: `UUID v7`, generated app-side. Column type `UUID`.
- Timestamps: `TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Strings: `VARCHAR(N)` bounded; `TEXT` only for URLs / long descriptions.
- Soft delete: NOT used. Hard delete + audit table if business requires history.
- Audit columns: `created_at` only. `updated_at` is opt-in per entity (must be justified — usually means an audit-log or event-sourcing alternative was rejected).
- Naming: `plural snake_case` tables (`users`, `goal_progress`), `snake_case` columns.
- JSONB: only for semantically opaque payload (e.g., `block.payload` for polymorphic content). Structured fields → first-class columns.

## Zero-downtime patterns (mandatory for existing tables)

- New NOT NULL column → 3-step (add nullable → backfill → SET NOT NULL).
- New index on existing table → `CREATE INDEX CONCURRENTLY` (one statement per file — golang-migrate transaction wrapper does not allow CONCURRENTLY inside a tx).
- Rename / drop column → 3-step (add new + dual-write in app code → backfill → drop old). Each phase = separate PR + deploy.

## Seeds

- **Bootstrap** (admin user, default org): hardcoded deterministic UUID v7 in a migration file.
- **Lookup** (statuses, currencies): separate migration, `INSERT ... ON CONFLICT DO NOTHING`.
- **Test fixtures**: NOT in `migrations/`. Generate factory functions in the repo's own test convention.
- **PII guard**: no real-looking emails / names. Use `admin@example.test`, `user-<uuid>@example.test`, `Test User`.

## Out of scope

- Multi-DB (read replicas, sharding).
- Partitioning.
- Materialized views.

These are perf / scale topics, not contract topics. Owned by SRE / DBA, decided per-project with a separate ADR.

## Контекст цього репо (не з курсового шаблону — дописано при бутстрапі)

`docs/architecture-map.md` §Сховища даних прямо каже: «БД | — | — | Немає» — основний
застосунок client-only, `DATABASE_URL` у `.env.example` позначений «у FREE-зрізі не
використовується». Живого дерева `migrations/` у репо нема, тож промоут staged-міграцій
`implement-tasks`-ом — гіпотетичний крок, не готовий до виконання. Фічі `tg-assistant` і
`rules-change-monitor` — окремі worker-скрипти поза цим правилом, кожна свідомо обрала
JSON-файл, не SQL (ADR-0003 / ADR-0002 відповідно). Дані нижче — навчальний прогін
пайплайна (урок 6.5), не рекомендація змінити ці ADR.
