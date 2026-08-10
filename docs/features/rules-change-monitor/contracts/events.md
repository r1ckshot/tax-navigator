---
status: Draft
owner: "Mike"
reviewers: []
updated_at: "2026-08-10"
feature_size: M
---

# Events — rules-change-monitor

<!-- Написано протоколом api-forge, крок 2/5 (скіл невендорений, запущено вручну). -->

Async-контракт для `sad.md` §6 (target surface `worker` — без request/response,
`target_surfaces: ["worker"]`). Ця фіча не має message-bus і окремого сервіса-споживача —
producer і consumer тут той самий локальний процес (`cycle.mjs`), запущений через cron
або вручну на машині Хранителя матриці (§7: «локальний CLI-скрипт без власного
розгортання»). Файл все одно генерується, бо обидва критерії шапки цього шаблону
виконані: Потік 1 §6 — асинхронна точка входу (cron), Потік 2 несе явну retry-нотатку
(AC-09).

## Channel: `rules-change-monitor.monthly-cycle`

- **Producer:** cron (або ручний запуск) на машині Хранителя матриці — self-wiring
  точка входу `cycle.mjs`.
- **Consumers:** `cycle.mjs` сам собою — жоден зовнішній сервіс не підписаний; Хранитель
  матриці читає готовий звіт-файл напряму, не як подію.
- **Delivery:** at-least-once — повторний запуск (наступний місяць або ручний ре-ран)
  переобробляє будь-який запис `rule_checks`, що лишився в нетермінальному стані.
- **Ordering:** немає — кожна перевірка `rule_id` незалежна в межах циклу.

## Event: `rules_change_monitor.cycle.v1`

```json
{
  "event_id": "<uuid>",
  "event_type": "rules_change_monitor.cycle",
  "version": 1,
  "occurred_at": "<iso8601>",
  "data": {
    "id": "<uuid — cycle_runs.id>",
    "month": "<string, YYYY-MM — cycle_runs.month>",
    "status": "<completed|partial — cycle_runs.status>",
    "started_at": "<iso8601 — cycle_runs.started_at>",
    "finished_at": "<iso8601|null — cycle_runs.finished_at>"
  }
}
```

- **Required fields:** `event_id, event_type, version, occurred_at, data.id, data.month, data.status, data.started_at`.
- **Origin:** `sad.md` §6 Потік 1 (`Cycle->>Report: Формує місячний звіт`) + `data-model.md` → `cycle_runs`.
- **Backwards-compat policy:** additive-only — нове опційне поле можна додавати; видалення/перейменування — нова версія (`v2`).

## Event: `rules_change_monitor.rule_check.v1`

```json
{
  "event_id": "<uuid>",
  "event_type": "rules_change_monitor.rule_check",
  "version": 1,
  "occurred_at": "<iso8601>",
  "data": {
    "id": "<uuid — rule_checks.id>",
    "cycle_id": "<uuid — rule_checks.cycle_id>",
    "rule_id": "<string, maxLength 64 — rule_checks.rule_id>",
    "state": "<string, maxLength 32, one of 7 — rule_checks.state, AC-03>",
    "source_value": "<string|null — rule_checks.source_value>",
    "matrix_value": "<string — rule_checks.matrix_value>",
    "failure_reason": "<string|null — rule_checks.failure_reason, AC-08>",
    "diff_percent": "<number|null — rule_checks.diff_percent, AC-04/05>"
  }
}
```

- **Required fields:** `event_id, event_type, version, occurred_at, data.id, data.cycle_id, data.rule_id, data.state, data.matrix_value`. `diff_percent` — опційне (NULL, доки `state` не розбіжність).
- **Origin:** `sad.md` §6 Потік 1 (`Cycle->>Diff: Визначає стан запису`) + Потік 3 (класифікація) + `data-model.md` → `rule_checks`.
- **Backwards-compat policy:** additive-only. `diff_percent` додано 2026-08-10 як опційне поле — сумісно, без бампу версії (`v1` лишається `v1`).

## Idempotency & retry

- **Idempotency:** `cycle_runs.month` — UNIQUE (`data-model.md`). Дедуп-ключ циклу — не
  `event_id`, а сам місяць: повторний запуск того самого місяця й є ідемпотентністю цієї
  фічі, задокументованою в моделі даних, не брокером.
- **Retry:** без exponential backoff у межах одного запуску. Retry = наступний плановий
  cron-запуск (§6 Потік 2: «Наступний цикл повторить саме цей запис», AC-09) — через
  `state.mjs`/`cycle-history.json`, не через redelivery черги.
- **Dead-letter:** N/A — у cron немає порогу DLQ; невдалий запис лишається в стані «не
  вдалось перевірити» й повторюється щомісяця, доки джерело не відновиться (AC-09
  свідомо не встановлює ліміт спроб).

## Schema registry

- Registry: N/A — канонічне джерело типів тут же, у `data-model.md`; окремого
  schema-registry чи message-broker у репо немає.
- Validator: N/A — немає межі процесу, яку подія перетинає (self-contained script, `sad.md` §7).

<!-- Чому events.md, а не openapi.yaml: target_surfaces=["worker"] задекларовано
architecture-design (sad.md frontmatter), api-forge лише читає. Чому не порожній файл:
обидва критерії шаблону виконані (async trigger + retry-нотатка), але це не класичний
pub/sub — producer і consumer той самий процес, DLQ у прямому сенсі немає. Задокументовано
як відхилення вище, не приховано мовчки. -->
