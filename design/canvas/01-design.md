# Canvas run 01 — sources page (`/sources`)

Executor: the Claude Code session on Windows that has the Pencil MCP connected.
Everything else in this lesson (code, tests, git, PR) happens in a different
session. You work only on the canvas and write only the files listed below.

## Hard limits

- Tools: Pencil MCP, `Read` on this repository, `Write` only to
  `design/canvas/report-01.md` and `design/canvas/export/*.png`.
- Do not edit code, `design/brief.md`, or any other file. Do not run git.
- Do not invent numbers. The page shows no tax values at all: only rule ids,
  source links, verification dates and a freshness state.
- All UI copy is Ukrainian and given below verbatim. Do not add advice
  ("варто", "краще", "рекомендуємо") or any copy that is not listed here.
- Color never carries meaning alone: every state badge is shape + text.

## Read first

1. `design/brief.md` — the screen, states, layouts.
2. `app/lib/rules/rules.2026.json` — the 26 rules (`rule_id`, `source_url`, `verified_at`).
3. `app/components/SourceCitation.tsx` + `.module.css` — how a source is shown today.
4. `app/components/RiskBadge.tsx` + `.module.css` — the shape + text badge pattern to mirror.

## Transaction 1 — variables (read back, then continue to Transaction 2)

Define exactly these on `design/sources.pen`, two themes `light` and `dark`.
They are the resolved ROLE layer of `app/globals.css`, not the raw palette.

| name | light | dark |
|---|---|---|
| surface | #fefdfb | #262521 |
| plane | #e7e4da | #100f0d |
| sunken | #f2f0ea | #1c1b18 |
| ink | #1c1a13 | #f5f4ef |
| ink-secondary | #56534b | #c3c2b7 |
| ink-muted | #85837a | #8f8d86 |
| hairline | #e3e1db | #33322f |
| hairline-strong | #cdcbc2 | #46453f |
| accent | #0f766e | #2dd4bf |
| accent-hover | #0b5c55 | #5eead4 |
| accent-ink | #ffffff | #06302c |
| accent-soft | #e6f2f0 | #12332f |
| accent-border | #9ecdc7 | #2a5551 |
| risk-green | #0ca30c | #0ca30c |
| risk-yellow | #fab219 | #fab219 |
| risk-red | #d03b3b | #d03b3b |

Numbers, px, same in both themes (rem × 16):
`space-1 4`, `space-2 8`, `space-3 12`, `space-4 16`, `space-5 24`, `space-6 32`, `space-7 48`,
`radius-sm 6`, `radius 10`, `radius-lg 14`,
`text-xs 12.5`, `text-sm 14`, `text-base 16`, `text-md 18`, `text-lg 21.6`, `text-xl 26`, `text-2xl 31.2`.

After `SetVariables`, call `GetVariables` and put the read-back table
(`name | light | dark | matches`) into the report. 33 rows expected.

## Transaction 2 — components (every fill, stroke, gap, radius, size bound to a variable)

1. **FreshnessBadge**, variants:
   - `fresh`: glyph `●` in `risk-green` + text `звірено` in `ink-secondary`, `text-sm`.
   - `stale`: glyph `▲` in `risk-yellow` + text `давно не звірялось` in `ink`, `text-sm`.
   Inline row, gap `space-1`, no background.
2. **RuleRow**, props: `ruleId`, `sourceHost`, `verifiedAt`, `state` (instance of FreshnessBadge).
   Layout: `ruleId` in monospace `text-sm` `ink`; under it the source host as a link
   (`accent`, underlined); right side (desktop) or below (mobile): `verifiedAt` in
   `ink-muted` + the badge. Bottom border `hairline`. Vertical padding `space-3`.
   Variants: `fresh`, `stale`. Only the badge differs; no row background change.
3. **RuleGroup**: heading (`text-md`, weight 600, `ink`) + count in `ink-muted`
   (`N правил`) + a vertical stack of RuleRow instances. Card: `surface` fill,
   `hairline` border, `radius-lg`, padding `space-5`.

Read back each component with `Get` and list its variables in the report.

## Transaction 3 — frames

Page background `plane`. Content column max 736px (46rem) centered, as in the product.

Copy, verbatim:

- H1 (`text-2xl`, weight 700): `Джерела цифр`
- Lead (`text-md`, `ink-secondary`): `Кожна цифра в розрахунках має джерело і дату, коли її востаннє звірено з ним.`
- Summary line (`text-sm`, `ink-muted`): `26 правил · 8 груп · звірка не рідше ніж раз на 90 днів`
- Group headings, in this order, with rule prefix → heading:
  `residency` → `Податкове резидентство`, `common` → `Спільні величини`,
  `fop` → `Український ФОП`, `jdg` → `Польський JDG`, `incubator` → `Інкубатор`,
  `nierejestrowana` → `Без реєстрації (nierejestrowana)`,
  `zlecenie` → `Договір-доручення (zlecenie)`, `uop` → `Трудовий договір (UoP)`.
- Footer note (`text-xs`, `ink-muted`), the existing product disclaimer, verbatim:
  `Це інформаційний калькулятор орієнтовного характеру. Він не є податковою консультацією і не подає декларацій.`

Rows: all 26 rules from `rules.2026.json`, grouped by the part of `rule_id` before
the first dot, `sourceHost` = hostname of `source_url`, `verifiedAt` = `verified_at`.

Frames:

1. `Desktop 1440 — default` (width 1440): all rules `fresh`.
2. `Mobile 390 — default` (width 390): same content; RuleRow stacks vertically,
   content padding `space-4`.
3. `Desktop 1440 — stale` (width 1440): identical to 1, except `jdg.ryczalt.rate`
   and `uop.pit` use the `stale` variant, and the summary line reads
   `26 правил · 8 груп · 2 давно не звірялись`. This is a fixture: today no rule is stale.

Loading, error, disabled, source unavailable: N/A (see brief), no frames.

## After writing

1. Run layout analysis on all three frames. List every clipping or overlap, or write `none`.
2. Export PNG of each frame to `design/canvas/export/`:
   `desktop-default.png`, `mobile-default.png`, `desktop-stale.png`.
3. Save the `.pen` file.
4. Write `design/canvas/report-01.md` with sections:
   `Variables read-back`, `Components`, `Frames` (name + node id), `Layout check`,
   `Deviations from this file` (or `none`).
5. Stop. Do not implement anything. A human approves the frames first.
