# Events — rules-change-monitor (contract-forge run, порівняння з api-forge)

<!-- Написано протоколом contract-forge, крок 7/8 (порівняльний прогін на тій самій фічі,
що вже пройшла курсовий api-forge — docs/features/rules-change-monitor/contracts/events.md).
Формат — той самий, що data-model-migrations-forge.md: не повний дубль, інлайн-нотатки Δ
на кожне реальне розходження. -->

## Вхід той самий

`target_surfaces: ["worker"]` (задекларовано `architecture-design`, обидва скіли лише
читають), `data-model.md` (з `diff_percent`, вже після reconcile-демо) — сценарій A для
обох прогонів.

## Результат: структурно ідентично

`Channel`, обидва `Event`-блоки (`cycle.v1`, `rule_check.v1`), `Idempotency & retry`,
`Schema registry` — той самий вміст, що в `events.md` курсового прогону. Це не збіг:
курсовий `templates/events.md` НІКОЛИ не мав HTTP-специфічних дефолтів (`BearerAuth`,
cursor-пагінація, codegen) — вони живуть лише в `templates/openapi.yaml`. Тобто на
`worker`-поверхні `contract-forge`-Defaults таблиці (auth N/A, pagination N/A, codegen
опційний) просто нема що перевизначати — курсовий шаблон подій їх і так не нав'язує.

Δ contract-forge: жодного поля не додано й не прибрано в самих event-схемах.

Δ contract-forge: Channel-секція курсового прогону вже сама (вручну, під час прогону)
приписала «producer і consumer — той самий процес» — `contract-forge`'s SKILL.md робить
це явною вимогою шаблону (`## Channel` коментар: «якщо це той самий процес... написати
прямо»), не залежить від того, чи згадає про це конкретний прогін.

Δ contract-forge: `api-sync-report.md` курсового прогону позначає «Error code ↔ repo
error definition — ✓ N/A» як **висновок під час drift-check**. `contract-forge`'s
Defaults таблиця фіксує це як **очікування з самого початку** для worker/events без
межі HTTP-response — та сама відповідь, дійшли до неї по-різному: курсовий скіл
розпізнає це кожного разу заново, свій — вже знає.

## Де різниця реально показала б себе

Не тут. Вона зʼявилась би на гіпотетичній `backend-service`-фічі (яких у цьому репо
поки нема): курсовий `api-forge` дефолтить `BearerAuth` + cursor-пагінацію +
codegen-крок на кожен `openapi.yaml`-прогін, які треба свідомо override; `contract-forge`
лишає їх opt-in — коментар над `security:` у `templates/openapi.yaml` явно каже
розкоментувати лише за потреби. Це різниця в **дефолтному напрямку**, не в конкретному
файлі цього прогону.

## Codegen

Курсовий `api-forge/SKILL.md` codegen-крок не згадує взагалі — очікування codegen
(`oapi-codegen`/`openapi-typescript`) прийшло з тексту завдання лекції, не зі скіла.
`contract-forge` фіксує це прямо в Protocol крок 4 (codegen — опція, коли є `openapi.yaml`)
— не розходження зі скілом, уточнення того, що завдання мовчки припускало.
