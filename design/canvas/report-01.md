# Canvas run 01 — report

Виконано за `design/canvas/01-design.md` цілком: Transaction 1 → 2 → 3 → After
writing. Документ: `design/sources.pen`.

## Variables read-back

`SetVariables` викликано з `replace: true` (33 змінні, нічого зайвого), `GetVariables`
підтвердив кожне значення без розбіжностей.

| name | light | dark | matches |
|---|---|---|---|
| surface | #fefdfb | #262521 | ✓ |
| plane | #e7e4da | #100f0d | ✓ |
| sunken | #f2f0ea | #1c1b18 | ✓ |
| ink | #1c1a13 | #f5f4ef | ✓ |
| ink-secondary | #56534b | #c3c2b7 | ✓ |
| ink-muted | #85837a | #8f8d86 | ✓ |
| hairline | #e3e1db | #33322f | ✓ |
| hairline-strong | #cdcbc2 | #46453f | ✓ |
| accent | #0f766e | #2dd4bf | ✓ |
| accent-hover | #0b5c55 | #5eead4 | ✓ |
| accent-ink | #ffffff | #06302c | ✓ |
| accent-soft | #e6f2f0 | #12332f | ✓ |
| accent-border | #9ecdc7 | #2a5551 | ✓ |
| risk-green | #0ca30c | #0ca30c | ✓ |
| risk-yellow | #fab219 | #fab219 | ✓ |
| risk-red | #d03b3b | #d03b3b | ✓ |
| space-1 | 4 | 4 | ✓ |
| space-2 | 8 | 8 | ✓ |
| space-3 | 12 | 12 | ✓ |
| space-4 | 16 | 16 | ✓ |
| space-5 | 24 | 24 | ✓ |
| space-6 | 32 | 32 | ✓ |
| space-7 | 48 | 48 | ✓ |
| radius-sm | 6 | 6 | ✓ |
| radius | 10 | 10 | ✓ |
| radius-lg | 14 | 14 | ✓ |
| text-xs | 12.5 | 12.5 | ✓ |
| text-sm | 14 | 14 | ✓ |
| text-base | 16 | 16 | ✓ |
| text-md | 18 | 18 | ✓ |
| text-lg | 21.6 | 21.6 | ✓ |
| text-xl | 26 | 26 | ✓ |
| text-2xl | 31.2 | 31.2 | ✓ |

33 рядки, як і очікувалось у файлі.

## Components

Три reusable-компоненти, кожен прочитаний назад через `Get` після побудови.

- **FreshnessBadge** — id `Y63ayn`. Inline-рядок, без фону. Використані змінні:
  `gap:$space-1`; `Glyph` (`fill:$risk-green`, `fontSize:$text-sm`, content `●`);
  `Label` (`fill:$ink-secondary`, `fontSize:$text-sm`, content `звірено`).
  Це базовий (fresh) вигляд компонента — варіант `stale` існує лише як
  override дескендантів на кожному інстансі (`Glyph`→`▲`/`$risk-yellow`,
  `Label`→`давно не звірялось`/`$ink`), бо .pen не має окремого механізму
  variant-сетів — тільки компонент + перевизначені інстанси.
- **RuleRow** — id `SnAPk`. Використані змінні: `stroke:$hairline`,
  `gap:$space-3`, `padding:[$space-3, 0]`; `Left.gap:$space-1`,
  `RuleId` (`fill:$ink`, `fontSize:$text-sm`, monospace `Roboto Mono`),
  `SourceHost` (`fill:$accent`, `fontSize:$text-sm`, `underline:true`);
  `Right.gap:$space-2`, `VerifiedAt` (`fill:$ink-muted`, `fontSize:$text-sm`),
  вкладений інстанс `Freshness` (ref на FreshnessBadge). `strokeWidth.bottom`
  лишився літералом `1` — токена товщини лінії в таблиці змінних немає, те саме
  робить сам продукт (`border-top: 1px solid var(--hairline)` у
  `SourceCitation.module.css`, `RiskBadge.module.css`): тільки колір
  токенізовано, товщина — ні.
- **RuleGroup** — id `Z9wzsc`. Використані змінні: `fill:$surface`,
  `stroke:$hairline`, `cornerRadius:$radius-lg`, `gap:$space-4`,
  `padding:$space-5`; `Header.gap:$space-2`, `Heading` (`fill:$ink`,
  `fontSize:$text-md`, `fontWeight:600` — вага без токена, як і в оригіналі),
  `Count` (`fill:$ink-muted`, `fontSize:$text-sm`); `Rows` — порожній слот
  (`width:fill_container`), наповнюється через `Replace` на кожному інстансі.

## Frames

| Frame | node id |
|---|---|
| Desktop 1440 — default | `bqeXd` |
| Mobile 390 — default | `pEKR8` |
| Desktop 1440 — stale | `rInfN` |

Кожен: 8 груп (`RuleGroup`-інстанси), 26 рядків (`RuleRow`-інстанси) сумарно,
дані — з `app/lib/rules/rules.2026.json` (`rule_id`, hostname з `source_url`,
`verified_at`). Порядок і заголовки груп — точно як у файлі (`residency →
Податкове резидентство` … `uop → Трудовий договір (UoP)`). Копірайт (H1, lead,
summary, footer) — verbatim.

Скріншотами перевірено: default-рядки — `●` + «звірено»; у stale-фреймі саме
`jdg.ryczalt.rate` і `uop.pit` — `▲` + «давно не звірялось» (форма відрізняється,
не лише колір), інші 24 рядки лишились fresh; summary-рядок у stale-фреймі —
«26 правил · 8 груп · 2 давно не звірялись»; мобільний рядок стекається
вертикально (`ruleId` → посилання → дата+бейдж під ними).

## Layout check

**Жодного clipping/overlap на фінальному стані всіх трьох фреймів** (перевірено
візитором по `ctx.problems` — `none` для кожного).

Проміжна нотатка: одразу після побудови той самий запит одноразово показав
"partially/fully clipped" на останній групі й футері в обох desktop-фреймах —
`Content`-фрейм ще не встиг перерахувати `fit_content`-висоту після серії
вставок (canvas — live-документ, лейаут доганяє асинхронно). Повторний
запит за кілька секунд повернув чисті координати й нуль проблем. Помилки в
дизайні це не було — просто гонка між вставкою і релейаутом; фіксую тут, бо
"чесно про прогін" стосується й перевірок canvas, не лише тестів коду.

## Deviations from this file

- **Імена експортованих PNG.** `Export` у Pencil MCP іменує файли за id вузла
  й не приймає довільне ім'я файлу — параметр `outputPath` для картинок це
  завжди директорія. Отримано:
  - `design/canvas/export/bqeXd.png` = Desktop 1440 — default
  - `design/canvas/export/pEKR8.png` = Mobile 390 — default
  - `design/canvas/export/rInfN.png` = Desktop 1440 — stale

  Перейменувати на `desktop-default.png` / `mobile-default.png` /
  `desktop-stale.png` інструментами, дозволеними цим прогоном (Pencil MCP,
  `Read`, `Write` лише на `report-01.md` і `export/*.png`), неможливо — це
  потребує файлової операції (rename/move), якої немає в жодному дозволеному
  тулі. Потрібне підтвердження: перейменувати вручну чи лишити id-імена з цим
  мапінгом.
- **`href` на посиланні джерела.** Крім тексту host, кожен `SourceHost`
  отримав `href` = реальний `source_url` з `rules.2026.json` (не вигадане
  значення) — дзеркалить справжній `<a href={s.url}>` з `SourceCitation.tsx`.
  Файл цього явно не просив (лише «як посилання, accent, підкреслено»).
- **Непроговорені у файлі значення spacing.** Гейп між H1/lead/summary/картками
  на сторінці — `$space-6`; гейп у заголовку картки (heading↔count) — `$space-2`;
  гейп між лівим і правим блоком у мобільному RuleRow — `$space-2`; шрифт
  `ruleId` — `Roboto Mono` (Google Font). Файл не фіксував ці конкретні
  значення — обрано з наявної шкали токенів, нових токенів не додано.
- Усе інше — точно за файлом: 33 змінні, 3 компоненти з описаною структурою,
  3 фрейми з вказаними розмірами, verbatim-копірайт, 26/8 групування, stale
  тільки на фікстурі (`jdg.ryczalt.rate`, `uop.pit`).

## Save

Явної функції `Save` у `execute` API немає (список: `Insert/Copy/Update/
Replace/Move/Delete/Generate/SetVariables/Get/GetVariables/FindEmptySpace/
Print/TakeScreenshot/Export`) — кожна мутація застосовується до
`design/sources.pen` одразу; окремого кроку збереження не існує.
