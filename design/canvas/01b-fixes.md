# Canvas run 01b — fixes before approval

Same executor and hard limits as `design/canvas/01-design.md`. Touch only the
three existing frames and the RuleGroup / RuleRow components. Write only
`design/canvas/report-01b.md` and `design/canvas/export/*.png`.

1. **Count copy in every RuleGroup header** uses Ukrainian plural forms:
   1 → `1 правило`, 2–4 → `N правила`, 5 and more → `N правил`.
   Expected by group: residency `3 правила`, common `2 правила`, fop `2 правила`,
   jdg `6 правил`, incubator `1 правило`, nierejestrowana `4 правила`,
   zlecenie `4 правила`, uop `4 правила`.
   Before writing, count the rows in each group from `app/lib/rules/rules.2026.json`
   and report any group where your count differs from the list above. Do not
   silently follow the list.
2. **No bottom border on the last RuleRow** of each group. Every other row keeps it.
3. Run layout analysis again on all three frames and list clipping / overlap or `none`.
4. Export PNG of the three frames to `design/canvas/export/` (id names are fine).
5. Write `design/canvas/report-01b.md`: per-group counts, what changed, layout check,
   node ids of the three frames.
6. Stop. The human saves the file with Ctrl+S in Pencil.
