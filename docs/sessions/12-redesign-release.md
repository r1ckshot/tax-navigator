# 12 · Редизайн: решта екранів, еталони, реліз

Тема 2.2 · сесія 4 з 4 · гілка `feat/redesign` · Sonnet · high

## Мета

Усі екрани в новій системі в обох темах і на 375px, еталони оновлені, тема злита,
вийшов реліз.

## Прочитати

- `visual/README.md`, `.claude/rules/visual-review.md`
- `/sources`, `/tokens`, темна тема в `globals.css`

## Кроки

1. `/sources` і `/tokens` у новій системі; темна тема на всіх екранах; 375px без
   горизонтального скролу.
2. `/design-lab` видалити повністю.
3. Еталони: CI знімає всі скріншоти, Mike забирає артефакт, сесія розпаковує.
4. Рев'ю: `diff-reviewer`, `/audit-i18n-safety`, `product-safety-review`.
5. `npm run verify`, `npm run test:ui`.
6. Версія minor: `package.json` + CHANGELOG (Changed — новий вигляд і бренд) →
   `gh pr ready` → мердж.

## Агенти й скіли

- `diff-reviewer`, `product-safety-review`, `/audit-i18n-safety`, `feature-ship`

## Крок Mike

1. Фінальний перегляд превʼю.
2. Артефакт скріншотів у репо.

## Готово коли

- [ ] Жодного `/design-lab` у гілці
- [ ] Еталони оновлені й прийняті Mike
- [ ] `verify` і `test:ui` зелені; CHANGELOG і версія; PR злитий, реліз вийшов
