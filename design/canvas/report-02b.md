# Canvas run 02b — report

Виконано за `design/canvas/02b-fixes.md`. Торкнулись лише компонента
`TrustNote` (`PdHg0`) і двох фреймів `Landing … — new` (`uCOTE`, `otfQs`).

## Що змінено

1. **Розмір тексту в TrustNote:** обидва рядки `text-sm` → `text-base`
   (кольори не чіпались: `Line1` лишився `$ink-secondary`, `Line2` —
   `$accent`). Обгортку підкреслення (`Link`/`Underline`, run 02) перевиміряно
   заново на новому кеглі: ширина тексту `Line2` зросла з `123px` до `140px`
   — саме на це значення оновлено і `Link.width`, і `Underline.width`.
2. **Відступи в hero-картці обох `— new` фреймів:**
   - gap між кнопкою «Пройти анкету» і `TrustNote` (`CtaWithTrust.gap`):
     `$space-4` → `$space-5` (24).
   - нижній padding картки (`section.padding`): був `[55.6, 37.6]`
     (vertical, horizontal — успадковано з живого імпорту run 02);
     переведено на 4-значну форму `[55.6, 37.6, $space-5, 37.6]` — верх і
     боки лишились точно ті самі (`55.6`/`37.6`, не займались), низ став
     `$space-5` (24).

## Виміряні відстані (не з властивостей — з реальних `ctx.bounds`)

| Frame | button bottom → TrustNote top | TrustNote bottom → card bottom | рівні? |
|---|---|---|---|
| Landing 1440 — new (`uCOTE`) | 24.00px | 24.00px | так |
| Landing 390 — new (`otfQs`) | 24.00px | 24.00px | так |

Обидва проміжки в обох фреймах — рівно `space-5` (24px) і збігаються між
собою: `TrustNote` стоїть точно посередині між кнопкою і нижнім краєм
картки, як і вимагав файл.

## Layout check

Для кожного текстового вузла в hero-картці обох `— new` фреймів порівняно
ліву/праву межу з внутрішньою межею контентної зони картки (той самий метод,
що в run 02: горизонтальний padding картки `37.6` з кожного боку, у масштабі
живого імпорту). Результат — **`none`** для обох фреймів: жоден текстовий
вузол за межу не виходить (у т.ч. після збільшення шрифту `TrustNote` до
`text-base`).

## Frames (node id)

| Frame | node id |
|---|---|
| Landing 1440 — new | `uCOTE` |
| Landing 390 — new | `otfQs` |

Компонент: `TrustNote` — `PdHg0` (`Line1` `F8Ucr6`, `Link` `n59AO`, `Line2`
`OW0VB`, `Underline` `vXbwr`).
