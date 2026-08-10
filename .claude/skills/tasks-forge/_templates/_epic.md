---
type: epic
project: tax-navigator
feature: <feature-slug>
iteration: 1
created: <YYYY-MM-DD>
stories_total: <N>
waves: <K>
---

# Epic: <feature-slug>

**Ітерація:** 1 (MVP)
**Дата створення:** <YYYY-MM-DD>

## Проблема

<Один абзац з PRD §1 Контекст. ≤600 символів.>

## Рішення

<Один абзац з PRD §2 Цілі. 3-5 буллетів теж ок. ≤500 символів.>

## Progress

- [ ] [[S-1-<slug>|S-1: <title>]] — <est> — <priority>
- [ ] [[S-2-<slug>|S-2: <title>]] — <est> — <priority>
- [ ] [[S-N-<slug>|S-N: <title>]] — <est> — <priority>

**Total:** 0/<N> stories done

## Dependencies

```
S-1 [<short-title>]
 │
 ▼
S-2 [<title>]
```

<ASCII-граф box-drawing символами (`│ ▼ ├──`). Одне речення на "may parallel" пару, якщо
є — а якщо нема жодної (лінійний пайплайн, sad.md §5 прямо каже "послідовно") — сказати
це прямо, не імітувати паралелізм, якого нема.>

## Waves

| Wave | Stories | May parallel | Goal |
|------|---------|--------------|------|
| 1 | S-1 | — | Foundation: сутності + staged-міграції |
| 2 | S-2, S-3 | yes/— | <мета хвилі> |

## Scope

### Що входить

- <буллет з PRD §2 Цілі — один рядок>

### Що НЕ входить

- <буллет з PRD §3 Поза межами — один рядок>

## Ризики

| Ризик | Severity | Mitigation |
|---|---|---|
| <з PRD §6.1 abuse cases чи sad.md §11 Ризики> | <Low/Medium/High> | <одно-рядкове пом'якшення> |

## Метрики успіху

<з PRD §7 KPI як нумерований список, target + вікно виміру, без формули виміру.>

1. <KPI 1 — target — вікно>
2. <KPI 2 — target — вікно>
