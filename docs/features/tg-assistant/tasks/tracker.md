---
type: tracker
feature: tg-assistant
updated_at: 2026-09-16
---

# Tracker — tg-assistant

Flat status for impl-agent polling. Pick the lowest-ID story with `status: todo` and `blocked_by` clear of any non-`done` story.

| Story | Wave | Status | Blocked by | Estimate |
|---|---|---|---|---|
| [[S-1-tg-assistant\|S-1]] | 1 | done | — | 2d |
| [[S-2-tg-assistant\|S-2]] | 2 | done | S-1 | 1d |
| [[S-3-tg-assistant\|S-3]] | 3 | done | S-2 | 1.5d |
| [[S-4-tg-assistant\|S-4]] | 4 | done | S-3 | 1d |

## Status legend

- `todo` — ready to claim once `blocked_by` clears.
- `wip` — claimed by an impl-agent or a human; do not pick.
- `done` — merged. Unblocks anything that listed this story in `blocked_by`.
- `blocked` — impl-agent or human reported an issue. See the story file's footer for the note.

## Progress

- Total: 4/4 stories done
- Wave 1: 1/1 done
- Wave 2: 1/1 done
- Wave 3: 1/1 done
- Wave 4: 1/1 done
