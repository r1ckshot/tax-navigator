# 07 · Право працювати: екрани, рев'ю, реліз

Тема 1.3 · сесія 3 з 3 · гілка `feat/legal-basis` · Sonnet · high

## Мета

Нові питання і стани видно на екрані на десктопі й на 375px. Рев'ю пройдене, тема
злита, вийшов реліз `0.3.0`.

## Прочитати

- `.claude/rules/visual-review.md`; `visual/README.md` (еталони, артефакт)
- Компоненти `Question`, `ScenarioCard`, `ComparisonTable`, `RiskBadge`
- CLAUDE.md §Pull requests (версія)

## Кроки

1. Нові питання в `Question`. Стан «недоступно» в `ScenarioCard` і
   `ComparisonTable`: причина + посилання на джерело. Жовтий ризик JDG у `RiskBadge`.
2. Пуш → превʼю Vercel → посилання Mike. Наступні кроки — після його «ок» вигляду.
3. Еталони: CI знімає нові скріншоти, Mike забирає артефакт, сесія розпаковує
   (DECISIONS 2026-08-25).
4. Рев'ю: `diff-reviewer`, `/audit-i18n-safety` на нових ключах, `rules-auditor`.
5. `npm run verify`, `npm run test:ui`.
6. `0.3.0`: `package.json` + секція CHANGELOG (Added — питання про право і
   недоступні форми; Changed — ризик B2B для JDG). `gh pr ready` → мердж.

## Агенти й скіли

- `diff-reviewer`, `rules-auditor`, `/audit-i18n-safety`, `product-safety-review`
- `feature-ship` — DoD і чернетка STATE перед мержем

## Крок Mike

1. Відкрити превʼю на телефоні й десктопі, сказати, що не так.
2. Якщо еталони змінились — завантажити артефакт скріншотів із прогону і покласти зіп у репо (процедура — `visual/README.md`).

## Готово коли

- [ ] Mike прийняв вигляд
- [ ] `npm run verify` і `npm run test:ui` зелені, лічильники в STATE збігаються
- [ ] `diff-reviewer` ACCEPT; `rules-auditor` без розривів ланцюга
- [ ] CHANGELOG і `0.3.0` у PR; PR злитий; `release.yml` створив `v0.3.0`
