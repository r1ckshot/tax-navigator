---
type: tracker
feature: tg-assistant
updated_at: 2026-08-10
---

# Tracker — tg-assistant

Flat status for impl-agent polling. Pick the lowest-ID story with `status: todo` and `blocked_by` clear of any non-`done` story.

| Story | Wave | Status | Blocked by | Estimate |
|---|---|---|---|---|
| [[S-1-tg-assistant\|S-1]] | 1 | todo | — | 2d |
| [[S-2-tg-assistant\|S-2]] | 2 | todo | S-1 | 1d |
| [[S-3-tg-assistant\|S-3]] | 3 | todo | S-2 | 1.5d |
| [[S-4-tg-assistant\|S-4]] | 4 | todo | S-3 | 1d |

## Status legend

- `todo` — ready to claim once `blocked_by` clears.
- `wip` — claimed by an impl-agent or a human; do not pick.
- `done` — merged. Unblocks anything that listed this story in `blocked_by`.
- `blocked` — impl-agent or human reported an issue. See the story file's footer for the note.

## Progress

- Total: 0/4 stories done
- Wave 1: 0/1 done
- Wave 2: 0/1 done
- Wave 3: 0/1 done
- Wave 4: 0/1 done
