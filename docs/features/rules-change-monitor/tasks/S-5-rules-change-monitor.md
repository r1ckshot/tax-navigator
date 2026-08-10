---
id: S-5
epic: rules-change-monitor
project: tax-navigator
wave: 4
priority: Must
estimate: 1.5d
blocks: []
blocked_by: [S-2, S-3, S-4]
status: todo
context_budget: ~2100 tokens
created: 2026-08-10
---

# S-5 · Місячний звіт + інваріант «рівно один стан на запис»

**Epic:** [[_epic|rules-change-monitor]]
**Priority:** Must
**Estimate:** 1.5d
**Wave:** 4

## Місце в послідовності

- **Блокується:** S-2 (звичайні + недоступні записи), S-3 (allowlist/verify-gated записи), S-4 (veto-перекласифіковані записи) — звіт мусить бачити результат УСІХ гілок класифікації, інакше AC-03 («жоден запис не лишається без стану») неможливо перевірити холістично.
- **Блокує:** нічим (terminal — останній модуль пайплайна).
- **Чому в цій хвилі:** останній крок Потоку 1 (`Cycle->>Report`) — читає вихід усіх попередніх stories, нічого не блокує далі.

## Why (user story)

**Як** Хранитель матриці, **я хочу** зведений звіт зі значенням джерела, значенням матриці й посиланням, і гарантію, що кожен запис отримав рівно один стан, **щоб** приймати рішення про оновлення без збору даних заново і не сумніватись, чи щось не пропущено мовчки.

Combines US-04 (AC-06, happy path) + US-02 (AC-03, domain invariant — «Trivial» за таблицею покриття §6, бо це не окрема гілка, а властивість, перевірювана лише після того, як усі гілки (S-2/S-3/S-4) відпрацювали).

## Linked artifacts (read-only references — DO NOT inline)

- 🌐 Sequence: [[../sad.md#Критичний потік 1: місячний цикл, happy path]] — Covered (AC-06, кінець потоку: `Cycle->>Report`); AC-03 Trivial (узагальнена властивість, не окремий крок).
- 🗄 Data delta: див. нижче
- 🌐 API contract: див. нижче (`cycle.v1`)
- 📋 PRD ACs: [[../PRD.md#5-acceptance-criteria|PRD §5]]

## Data delta

```
DELTA `cycle_runs` — SET status = 'completed' | 'partial', finished_at = now()
  ('partial', якщо хоч один rule_check лишився 'unavailable_retry' — S-2, AC-08/09)
NO NEW TABLE — reporter лише читає `rule_checks` (усі стани з S-2/S-3/S-4) + `cycle_runs`.
```

## API contract

```
event: rules_change_monitor.cycle.v1 (events.md)
  data.status: completed | partial
  data.finished_at: iso8601 (SET по завершенню звіту)
  Origin: sad.md §6 Потік 1 (Cycle->>Report: Формує місячний звіт) + data-model.md → cycle_runs.
```

## Acceptance criteria (GWT)

- [ ] **AC-06:** Given цикл завершив звірку з хоча б одним записом у стані «розбіжність» чи «не вдалось перевірити», when Хранитель відкриває звіт, then він бачить значення джерела, значення матриці, посилання й дату останньої звірки для кожного такого запису одним списком.
- [ ] **AC-03:** Given звірка завершилась, when система формує підсумок, then кожен запис отримує рівно один стан із визначеного набору («збігається»/«розбіжність»/«косметична відмінність»/«не вдалось перевірити»/«поза автозвіркою»/«потребує підтвердження»/«ще не верифіковано»), і жоден запис не лишається без стану.

## Checklist (atomic steps for impl-agent)

- [ ] Step 1 — Реалізувати `report.mjs`: зібрати всі `rule_checks` поточного `cycle_id` зі станом `substantive`/`unavailable_retry` у список для 30-хвилинного перегляду (AC-06) — `source_value`, `matrix_value`, `source_url`, `checked_at`.
- [ ] Step 2 — Додати перевірку інваріанту AC-03: кожен `rule_id` з allowlist-скоупу (S-1) + verified-скоупу (S-3 not_verified-виняток) має рівно один рядок `rule_checks` цього циклу з непорожнім `state` — якщо немає, це баг попередньої гілки (S-2/S-3/S-4), не мовчазний пропуск у звіті.
- [ ] Step 3 — По завершенню збірки виставити `cycle_runs.status` (`completed`, якщо жодного `unavailable_retry`; інакше `partial`) і `finished_at = now()`.
- [ ] Step 4 — Тест на регресію: калькулятор `zus.pl` (G2, `scripts/fetch-zus-benchmark.mjs` прецедент) — фікстура з відомим `substantive`-записом мусить з'явитись у звіті з коректним `diff_percent`.

## Definition of Done

- [ ] Усі checklist steps зроблені, всі AC зелені.
- [ ] Lint + типи clean (per SAD §2 Constraints).
- [ ] Integration test покриває всі ACs цієї story.
- [ ] PR linked back to this story file (`tasks/S-5-rules-change-monitor.md`).
- [ ] `tracker.md` оновлено: status `done`.
