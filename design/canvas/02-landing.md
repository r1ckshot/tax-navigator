# Canvas run 02 — landing trust note (`/`)

Executor: the same Windows Claude Code session with Pencil MCP. Same file:
`design/sources.pen`. Keep every existing frame and component untouched.

## Hard limits

- Tools: Pencil MCP (including its browser tool), `Read` on this repository,
  `Write` only to `design/canvas/report-02.md` and `design/canvas/export/*.png`.
- Do not edit code, briefs, or any other file. Do not run git.
- UI copy is Ukrainian and given below verbatim. Add no other copy.

## Read first

1. `design/landing/brief.md`
2. `app/page.tsx` + `app/page.module.css`
3. `design/canvas/report-01c.md` (what already exists in the file)

## Step 0 — current UI reference

Use the Pencil browser tool to load `https://tax-navigator-red.vercel.app/` and
bring it onto the canvas at 1440 and 390 widths as frames
`Landing 1440 — current` and `Landing 390 — current`.
If the page cannot be loaded, stop and report the exact error. Do not rebuild
the current page from memory.

## Transaction 1 — variables (reuse, read back, continue)

Do not create new variables. Call `GetVariables` and confirm the 33 variables
from run 01 are still present and unchanged. Put `33 present, 0 changed` or the
list of differences into the report, then continue.

## Transaction 2 — component

**TrustNote**: vertical stack, centered, gap `space-1`, no background.
- line 1, `text-sm`, `ink-secondary`: `Кожна цифра в розрахунках має джерело і дату звірки.`
- line 2, `text-sm`, `accent`, underlined, link to `/sources`: `Усі джерела цифр`

Every fill, size and gap bound to a variable. Read it back with `Get`.

## Transaction 3 — frames

1. `Landing 1440 — new`: copy of `Landing 1440 — current`, with one TrustNote
   instance inserted inside the hero card, directly under the «Пройти анкету»
   button, gap `space-4` above it. Nothing else changes.
2. `Landing 390 — new`: the same change on a copy of `Landing 390 — current`.

If the imported current frames are flat images and an element cannot be inserted
inside the card, place TrustNote over the card directly under the button, extend
the card height to fit, and say so in the report.

## After writing

1. Layout check on both new frames: for every text node compare its edges with
   the hero card edges; list clipping or overlap, or `none`.
2. Export PNG of `Landing 1440 — new` and `Landing 390 — new` to `design/canvas/export/`.
3. Write `design/canvas/report-02.md`: step 0 result, variables check, component,
   frames with node ids, layout check, deviations.
4. Stop. The human saves the file with Ctrl+S in Pencil.
