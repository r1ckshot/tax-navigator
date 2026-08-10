---
id: S-1
epic: rules-change-monitor
project: tax-navigator
wave: 1
priority: Must
estimate: 1.5d
blocks: [S-2, S-3]
blocked_by: []
status: todo
context_budget: ~2000 tokens
created: 2026-08-10
---

# S-1 · Схема даних циклів/звірок + власний allowlist

**Epic:** [[_epic|rules-change-monitor]]
**Priority:** Must
**Estimate:** 1.5d
**Wave:** 1

## Місце в послідовності

- **Блокується:** нічим (foundation).
- **Блокує:** S-2, S-3 — обидва читають/пишуть цю схему й `allowlist.mjs`.
- **Чому в цій хвилі:** передумова всіх трьох потоків §6 — жоден потік не малює
  foundation CRUD як окремий крок, але Потік 1/2/3 всі припускають, що ця
  схема й конфіг вже існують.

## Why (user story)

Precondition-story: жодна US напряму не вимагає схему саму по собі, але
US-01..US-05 усі покладаються на `cycle_runs`/`rule_checks`/`veto_entries`
(data-model.md) і `allowlist.mjs` (ADR-0003) як на існуючий фундамент.

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: місячний цикл, happy path]] — precondition, не окремий крок жодного з 3 потоків (Потоки 1/2/3 усі його припускають).
- 🗄 Data delta: див. нижче
- 🌐 API contract: `_API surface: none — internal story._` (події `events.md` з'являються лише коли є перший заповнений цикл, S-2+)
- 📜 Relevant ADR: [[../adr/0002-local-json-file-for-cycle-history-and-veto-list|ADR-0002]] (JSON-стан), [[../adr/0003-own-allowlist-in-script-not-parsed-from-firewall-config|ADR-0003]] (власний allowlist)
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
NEW table `cycle_runs` (root) — UNIQUE(month)
NEW table `rule_checks` (FK cycle_id → cycle_runs.id)
NEW table `veto_entries` (root, без FK — ручний список, data-model.md)
Migration files: staged під docs/features/rules-change-monitor/migrations/
  (той самий roundtrip node:sqlite, що verifikовано на _audit/data-model-2026-08-07.md)
+ `allowlist.mjs` — код-конфіг (НЕ таблиця): масив доменів автозвірки
  (zus.pl, podatki.gov.pl), окремий від firewall allowlist (ADR-0003).
```

## API contract

`_API surface: none — internal story._`

## Acceptance criteria (GWT)

- [ ] **AC-derived-1 (foundation, happy path):** Given staged-міграції прогнані проти `node:sqlite`, when `cycle.mjs` стартує черговий місяць, then воно може створити рядок `cycle_runs` з унікальним `month` без конфлікту схеми.
- [ ] **AC-derived-2 (foundation, invariant):** Given `allowlist.mjs` завантажено, when будь-який модуль (`sources.mjs`, `diff.mjs`) запитує «чи цей `source_url` у скоупі автозвірки», then відповідь опирається лише на цей власний список, а не на `.devcontainer/init-firewall.sh` (ADR-0003 — не парсити firewall-конфіг).

<!-- Precondition-story без прямого PRD AC — за протоколом Stage 2 п.2 (мінімум 2 AC),
обидва тут derived: перший з data-model.md self-check (roundtrip доведений на
rules-change-monitor раніше, _audit/), другий — прямий інваріант з ADR-0003. -->

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Визначити `cycle_runs`, `rule_checks`, `veto_entries` за `data-model.md` Entities; прогнати staged-міграції `migrations/` roundtrip up→down→up (як у `_audit/data-model-2026-08-07.md`).
- [ ] Step 2 — Реалізувати `allowlist.mjs`: масив `{domain, scripted: true}` для `zus.pl`, `podatki.gov.pl` — ADR-0003, не парсити `init-firewall.sh`.
- [ ] Step 3 — Додати обов'язкові FK-індекси (`idx_rule_checks_cycle_id`, `idx_veto_entries_rule_id` — `data-model.md` Indexes) і перевірити self-check.

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-1-rules-change-monitor.md`).
- [ ] `tracker.md` оновлено: status `done`.
