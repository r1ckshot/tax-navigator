---
type: tracker
feature: rules-change-monitor
updated_at: 2026-09-16
---

# Tracker — rules-change-monitor

Flat status for impl-agent polling. Pick the lowest-ID story with `status: todo` and `blocked_by` clear of any non-`done` story.

| Story | Wave | Status | Blocked by | Estimate |
|---|---|---|---|---|
| [[S-1-rules-change-monitor\|S-1]] | 1 | done | — | 1.5d |
| [[S-2-rules-change-monitor\|S-2]] | 2 | done | S-1 | 2.5d |
| [[S-3-rules-change-monitor\|S-3]] | 2 | done | S-1 | 1.5d |
| [[S-4-rules-change-monitor\|S-4]] | 3 | done | S-2, S-3 | 1d |
| [[S-5-rules-change-monitor\|S-5]] | 4 | done | S-2, S-3, S-4 | 1.5d |

## Status legend

- `todo` — ready to claim once `blocked_by` clears.
- `wip` — claimed by an impl-agent or a human; do not pick.
- `done` — merged. Unblocks anything that listed this story in `blocked_by`.
- `blocked` — impl-agent or human reported an issue. See the story file's footer for the note.

## Progress

- Total: 5/5 stories done (S-1, S-2 — капстоун M10, 2026-08-26; S-4, S-5 —
  POLISH сесія 5, 2026-09-16, issue #79)
- Wave 1: 1/1 done
- Wave 2: 2/2 done — S-3: класифікація без фетчу в `allowlist.mjs`, пауза між
  запитами до одного домену (QG-4) у `cycle.mjs`, challenge-сторінка WAF у
  `challenge.mjs` (POLISH сесія 6, issue #81)
- Wave 3: 1/1 done — `veto.mjs` + `veto-registry.json`
- Wave 4: 1/1 done — звіт файлом `data/reports/YYYY-MM.md`; `cycle_runs.status` уже з капстоуна
