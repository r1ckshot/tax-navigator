# Canvas run 02b — landing trust note spacing and size

Same executor and hard limits as `design/canvas/02-landing.md`. Touch only the
TrustNote component and the two `Landing … — new` frames (`uCOTE`, `otfQs`).
Write only `design/canvas/report-02b.md` and `design/canvas/export/*.png`.

1. **TrustNote size:** both lines `text-base` instead of `text-sm`. Colors stay.
   Re-measure the underline wrapper width after the size change.
2. **Spacing in the hero card of both new frames:**
   - gap between the «Пройти анкету» button and TrustNote: `space-5` (24);
   - bottom padding of the hero card: `space-5` (24);
   - top and side paddings of the card stay as they are.
   So the note sits exactly halfway between the button and the card's bottom edge.
3. **Measure, do not assume:** report button bottom → TrustNote top, and TrustNote
   bottom → card bottom edge, in px, for both frames. They must be equal.
4. Layout check as in run 02: every text node inside the card edges, or `none`.
5. Export PNG of both new frames to `design/canvas/export/`.
6. Write `design/canvas/report-02b.md`: the two measured gaps per frame, layout
   check, node ids. Stop. The human saves with Ctrl+S in Pencil.
