---
type: tracker
feature: rules-change-monitor
updated_at: 2026-08-10
---

# Tracker — rules-change-monitor

Flat status for impl-agent polling. Pick the lowest-ID story with `status: todo` and `blocked_by` clear of any non-`done` story.

| Story | Wave | Status | Blocked by | Estimate |
|---|---|---|---|---|
| [[S-1-rules-change-monitor\|S-1]] | 1 | done | — | 1.5d |
| [[S-2-rules-change-monitor\|S-2]] | 2 | done | S-1 | 2.5d |
| [[S-3-rules-change-monitor\|S-3]] | 2 | blocked | S-1 | 1.5d |
| [[S-4-rules-change-monitor\|S-4]] | 3 | todo | S-2, S-3 | 1d |
| [[S-5-rules-change-monitor\|S-5]] | 4 | todo | S-2, S-3, S-4 | 1.5d |

## Status legend

- `todo` — ready to claim once `blocked_by` clears.
- `wip` — claimed by an impl-agent or a human; do not pick.
- `done` — merged. Unblocks anything that listed this story in `blocked_by`.
- `blocked` — impl-agent or human reported an issue. See the story file's footer for the note.

## Progress

- Total: 2/5 stories done (капстоун M10, 2026-08-26 — гілка
  `feat/rules-change-monitor-capstone-m10`)
- Wave 1: 1/1 done
- Wave 2: 1/2 done — S-3 частково: класифікація без фетчу (`out_of_scope`,
  `not_verified`) реалізована в `allowlist.mjs`, гілка veto лишилась за S-4,
  тож story стоїть `blocked`, а не `done`. Пауза між запитами до одного домену
  (QG-4) і розпізнавання challenge-сторінки WAF теж не зроблені
- Wave 3: 0/1 done
- Wave 4: 0/1 done
