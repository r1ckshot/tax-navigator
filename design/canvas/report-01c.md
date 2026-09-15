# Canvas run 01c — report

Виконано за `design/canvas/01c-fixes.md`. Торкнулись лише трьох існуючих
фреймів і компонента `RuleGroup` (сам `RuleRow` не змінювався).

## Measured header widths (до фіксу)

Виміряно реальні `ctx.bounds` (не оцінка на око) для `Heading`+`Count` у
кожній з 24 карток (8 груп × 3 фрейми). Формула: `row = heading + 8 (gap
space-2) + count`; `inner = card − 2×24 (space-5 з обох боків)`.

| group | heading px | count px | row px | inner (desktop, 736 card) | inner (mobile, 358 card) |
|---|---|---|---|---|---|
| residency | 227 | 70 | 305 | 688 — fits | 310 — fits |
| common | 157 | 70 | 235 | 688 — fits | 310 — fits |
| fop | 160 | 70 | 238 | 688 — fits | 310 — fits |
| jdg | 141 | 62 | 211 | 688 — fits | 310 — fits |
| incubator | 89 | 68 | 165 | 688 — fits | 310 — fits |
| nierejestrowana | 290 | 70 | 368 | 688 — fits | **310 — overflow (+58px)** |
| zlecenie | 268 | 70 | 346 | 688 — fits | **310 — overflow (+36px)** |
| uop | 212 | 70 | 290 | 688 — fits | 310 — fits |

Card-ширина зчитана з реального `ctx.bounds`, не з константи: 736px на
обох desktop-фреймах, 358px на мобільному (`390 − 2×16 content-padding`).
Тільки на `Mobile 390 — default` рядок ширший за внутрішню ширину картки —
рівно у двох групах: **nierejestrowana** і **zlecenie**. На desktop-фреймах
(688px) всі 8 груп вміщаються в один рядок.

## Що змінено

1. **Summary-блок.** Старий однорядковий текст (`26 правил · 8 груп · …`)
   замінено (`Replace`) на вертикальний стек окремих `text`-рядків без
   роздільників, `text-sm`, gap `$space-1`:
   - `Desktop 1440 — default` і `Mobile 390 — default`: 2 рядки, обидва
     `$ink-muted` — `26 правил у 8 групах` / `Через 90 днів без звірки
     правило позначається як давно не звірене.`
   - `Desktop 1440 — stale`: ті самі 2 рядки + третій, `$ink` — `2 правила
     давно не звірялись`.
2. **Header wrap.** На основі вимірів вище — тільки на `Mobile 390 —
   default`, тільки для `nierejestrowana` (`FB61G`) і `zlecenie` (`mIh3j`) —
   `Header`-інстанс переведено з `layout:"horizontal"` на
   `layout:"vertical", gap:"$space-1", alignItems:"start"`: лічильник тепер
   під заголовком, а не поруч. Решта 22 інстансів `Header` (усі desktop +
   6 інших мобільних груп) не чіпались — там рядок і так вміщався.

## Per-node overflow check (Mobile 390 — default)

Виконано буквально за вимогою файлу: для **кожного** текстового вузла в
мобільному фреймі (26 `RuleRow` × 5 текстових полів кожен + 8×2
`Heading`/`Count`, включно з вкладеними інстансами `FreshnessBadge`)
пораховано абсолютну правий край відносно локальних координат картки
(`Σ ctx.bounds.x` по ланцюгу батьків, не сам `ctx.bounds` — він відносний
до найближчого батька) і порівняно з `cardWidth − 24` (правий край
контентної зони картки).

- **До фіксу header-wrap:** знайдено рівно 2 порушення — `Count` у
  `nierejestrowana` (вихід за межу на 58px) і `Count` у `zlecenie`
  (на 36px). Це збігається з попереднім прогоном (01b), де `ctx.problems`
  на цих самих вузлах мовчав — підтверджує, що сам по собі `ctx.problems`
  тут недостатній доказ, як і попереджав файл.
- **Після фіксу:** той самий обхід по всіх текстових вузлах — **`none`**,
  жодного вузла з правим краєм за межею картки.

Додатково перевірено `ctx.problems` на всіх трьох фреймах після фіксів —
теж `none`, але це вже друга, підтверджувальна перевірка, не єдина.

## Frames (node id)

| Frame | node id | export |
|---|---|---|
| Desktop 1440 — default | `bqeXd` | `design/canvas/export/bqeXd.png` |
| Mobile 390 — default | `pEKR8` | `design/canvas/export/pEKR8.png` |
| Desktop 1440 — stale | `rInfN` | `design/canvas/export/rInfN.png` |
