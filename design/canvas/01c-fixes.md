# Canvas run 01c — summary copy and mobile header wrap

Same executor and hard limits as `design/canvas/01-design.md`. Touch only the
three existing frames and the RuleGroup component. Write only
`design/canvas/report-01c.md` and `design/canvas/export/*.png`.

1. **Summary block** under the lead, in all three frames: replace the single line
   with separate text lines, no separators, `text-sm`, `ink-muted`, gap `space-1`.
   - default frames, two lines:
     `26 правил у 8 групах`
     `Через 90 днів без звірки правило позначається як давно не звірене.`
   - `Desktop 1440 — stale`, the same two lines plus a third line in `ink`:
     `2 правила давно не звірялись`
2. **RuleGroup header wraps.** Heading and count sit in one row when they fit the
   card's inner width; when they do not, the count moves under the heading
   (gap `space-1`). In `Mobile 390 — default` this applies to every group whose
   heading + gap + count is wider than the card content box. Measure it, do not
   guess: list the measured widths per group in the report.
3. **Layout check you cannot skip:** for every text node in the mobile frame,
   compare its right edge with the right edge of its card's content box. Report
   any node that ends beyond it. The previous run reported `none` while two
   counts overflowed the card, so `ctx.problems` alone is not accepted as proof.
4. Export PNG of the three frames to `design/canvas/export/`.
5. Write `design/canvas/report-01c.md`: measured header widths, what changed,
   the per-node overflow check result, node ids.
6. Stop. The human saves the file with Ctrl+S in Pencil.
