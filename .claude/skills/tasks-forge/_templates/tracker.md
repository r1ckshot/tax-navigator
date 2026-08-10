---
type: tracker
feature: <feature-slug>
updated_at: <YYYY-MM-DD>
---

# Tracker — <feature-slug>

Flat status for impl-agent polling. Pick the lowest-ID story with `status: todo` and `blocked_by` clear of any non-`done` story.

| Story | Wave | Status | Blocked by | Estimate |
|---|---|---|---|---|
| [[S-1-<slug>\|S-1]] | 1 | todo | — | 0.5d |
| [[S-2-<slug>\|S-2]] | 2 | todo | S-1 | 1d |
| [[S-N-<slug>\|S-N]] | <K> | todo | S-2 | 1d |

## Status legend

- `todo` — ready to claim once `blocked_by` clears.
- `wip` — claimed by an impl-agent or a human; do not pick.
- `done` — merged. Unblocks anything that listed this story in `blocked_by`.
- `blocked` — impl-agent or human reported an issue. See the story file's footer for the note.

## Progress

- Total: 0/<N> stories done
- Wave 1: 0/<a> done
- Wave 2: 0/<b> done
