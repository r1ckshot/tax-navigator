---
name: contract-forge
description: >-
  Особиста версія api-forge — той самий flow (читати PRD+sad.md+data-model.md
  → визначити вид інтерфейсу з target_surfaces → derive контракт → inline
  drift-check → sync-звіт → handoff), але під практику цього репо, не
  курсовий HTTP-first дефолт: (1) **events.md/cli.md — основна форма
  контракту, openapi.yaml — другорядна гілка** — обидві реальні фічі репо
  (`tg-assistant`, `rules-change-monitor`) worker/без інтерфейсу, жодна не
  backend-service; (2) **error envelope тільки там, де є межа процесу** —
  для worker/cli репо вже має свій патерн (`throw Error` + `process.exit(1)`,
  `sad.md` §8), JSON-конверт `{code,message,details?}` зʼявляється лише
  разом з реальним HTTP/подієвим контрактом, не мовчки за замовчуванням;
  (3) **codegen — опція, не крок за замовчуванням** — немає openapi.yaml у
  типовому прогоні, типи йдуть напряму з `data-model.md`; (4) **auth/pagination
  N/A за замовчуванням** — соло-локальні інструменти без авторизаційної межі
  й без HTTP-списків. Standalone, не прив'язаний до жодної фічі. Тригери:
  «/contract-forge <slug>», «контракт через contract-forge для <slug>».
  Адаптовано з
  `docs/course/agentic-engineering-course/sdlc/plugin/skills/api-forge` для
  порівняльного прогону в лекції api-forge.
triggers:
  - /contract-forge
stage: "10"
---

# Skill: contract-forge (особиста версія api-forge)

Той самий end-to-end прохід, що курсовий `api-forge`: визначити вид
інтерфейсу → derive контракт з `data-model.md`+`sad.md` §6+`PRD.md` →
inline drift-check (обидва напрямки) → sync-звіт → handoff. Цей файл —
повна копія (курсовий скіл ніколи не вендорився в `.claude/skills/`, тож
посилатись на дельту, як `sad-forge` → `architecture-design`, нема на що)
з переписаними дефолтами під практику цього репо.

## Чому events.md/cli.md за замовчуванням, а не openapi.yaml

Курсовий скіл читає `target_surfaces` і за замовчуванням очікує
`backend-service` (HTTP/OpenAPI) — це чесний дефолт для типового курсового
прикладу (`course-lesson-mvp`, `POST /lessons`), але не для цього репо:

- Обидві фічі, що реально дійшли до стадії контракту (`tg-assistant`,
  `rules-change-monitor`), — `target_surfaces: ["worker"]` або взагалі без
  HTTP-межі (`tg-assistant` PRD: «без публічного API»). Жодна не
  `backend-service`.
- `docs/architecture-map.md` не показує жодного HTTP-роута в
  `app/**` — продукт client-only, розрахунок на клієнті (CLAUDE.md,
  «Тверді правила продукту»).
- Якщо колись у репо зʼявиться реальний `backend-service` (наприклад,
  API route для чогось за межами client-only калькулятора) — шлях
  `openapi.yaml` лишається в цьому скілі як повноцінна, не обрізана гілка,
  просто не типова.

## Owner

Той, хто веде фічу (соло-проєкт — завжди Mike).

## When to use

- «контракт для `<slug>`», «events для `<slug>`», «API-поверхня для `<slug>`».
- Після `data-model.md` (`migrations-forge` чи курсовий) + `sad.md` §6.
- `/contract-forge <slug> --reconcile` — після зміни `data-model.md`, той
  самий цикл, що курсовий: перечитати, підтягнути нові поля, підняти
  впевненість, не бампати версію мовчки.
- Пропустити, якщо `contracts/` уже є і кожне поле контракту трасується
  до `data-model.md`.

## Inputs

- `<slug>` — той самий, що для PRD/SAD/data-model.
- **Gate (жорстка відмова, якщо нема):** `docs/features/<slug>/PRD.md`. Немає
  — STOP, вказати `/sdlc-write-prd` чи `/spec-forge <slug>`.
- **Рекомендовано (визначає сценарій A/B):** `docs/features/<slug>/data-model.md`
  (`migrations-forge` чи курсовий `generate-data-model`, обидва прийнятні
  джерела — сценарій A не питає, який саме скіл написав модель).
  `docs/features/<slug>/sad.md` §6 — `alt`-гілки → значення стану/події,
  retry-нотатки → Idempotency & retry.
- **Обов'язково прочитати перед деривацією:** `sad.md` frontmatter
  `target_surfaces` — визначає форму контракту (таблиця нижче). Порожньо
  → fallback на `docs/architecture-map.md` + `PRD.md` (шукати explicit
  «без публічного API» / «без HTTP» формулювання, не вгадувати).

## Форма контракту за `target_surfaces`

| `target_surfaces` | Форма | Коли |
|---|---|---|
| не задекларовано / PRD прямо каже «без публічного API» | **немає контракту** — одно-рядкова нотатка в `api-sync-report.md`, одразу до `break-tasks` | `tg-assistant` |
| `["worker"]` | **`contracts/events.md`** | `rules-change-monitor` |
| `["cli"]` | **`contracts/cli.md`** (шаблон переноситься з курсового скіла окремо, коли з'явиться перша `cli`-фіча — цей прогін його не транспортує, бо жодна поточна фіча його не потребує) |  |
| `["backend-service"]` | **`contracts/openapi.yaml`** — курсовий шлях без змін по суті, лише дефолти нижче | (поки жодної) |

## Defaults (власні, під практику цього репо — НЕ курсові)

| Тема | Курсовий дефолт | Дефолт цього скіла | Чому |
|---|---|---|---|
| Основна форма контракту | HTTP/`openapi.yaml`; `events.md` лише коли §6 має async-ознаки | **`events.md`/`cli.md` — типовий випадок**, `openapi.yaml` — другорядна, повноцінна, але нетипова гілка | Жодна поточна фіча репо не `backend-service` (таблиця вище) |
| Error envelope | `{code, message, details?}` JSON, `module.error_name` | **той самий, коли контракт має межу процесу** (events/HTTP); для worker/cli без такої межі — доменне поле в моделі (`failure_reason` тощо), не код-реєстр | Репо вже має свій патерн помилок для CLI/worker: `throw Error` + `process.exit(1)` (`sad.md` §8, `fetch-zus-benchmark.mjs:137-140`) — вигадувати паралельний JSON-реєстр помилок для скрипта, що ніхто не парсить програмно, було б курсовою формою заради форми |
| Auth | `BearerAuth` global, публічний ендпоінт — explicit `security: []` | **N/A за замовчуванням** | Кожна поточна фіча — соло-локальний інструмент без авторизаційної межі (`tg-assistant` PRD Security review, `rules-change-monitor` `sad.md` §8: «N/A — соло-локальний інструмент») |
| Pagination | Cursor (UUID v7) для list-ендпоінтів | **N/A за замовчуванням** | Немає HTTP list-ендпоінтів у жодній поточній фічі — з'явиться разом із першою `backend-service`-фічею, тоді courses-дефолт (cursor, не offset) застосовується без змін |
| Versioning | URL `/api/v1/...` | **той самий для `backend-service`**; для events — `<module>.<action>.v<N>` (курсовий формат, без змін) | Немає підстав відхилятись — просто типово немає HTTP-шляху, куди його писати |
| Codegen | `oapi-codegen`/`openapi-typescript` з `openapi.yaml`, обов'язковий крок hard-рівня | **опція, не крок за замовчуванням** — типи йдуть напряму з `data-model.md` (той самий принцип, що вже є в репо: `app/lib/rules/types.ts` як єдине джерело типів для rules-даних) | Немає `openapi.yaml` у типовому прогоні (events/cli) — генерувати нема з чого; повертається як крок, коли контракт таки `openapi.yaml` |
| Schema reuse | `$ref` обов'язковий, inline заборонено | **той самий**, коли є `openapi.yaml`; для `events.md` — типи посилаються на конкретну колонку `data-model.md`, не дублюються в самому контракті | Єдина точка правди для типів лишається `data-model.md` незалежно від форми контракту — той самий принцип, що «Правило залежностей» у `CLAUDE.md` |
| Forbidden | `nullable: true` (3.0), реальний PII, `additionalProperties: true`, `?v=2`, offset pagination | **той самий список** + вигаданий error-code реєстр там, де репо жодного не має (якщо немає центрального реєстру помилок — писати «no error registry found», не вигадувати коди) | Немає окремого розділу про API в `CLAUDE.md` (продукт не HTTP-first) — найближчий чинний аналог: «Правило залежностей» (одна точка правди для логіки, не розповзається по шарах) |

**Чому немає прямої цитати з `CLAUDE.md` для forbidden-списку:** так само, як
у `migrations-forge` — немає окремого розділу про API/помилки, бо продукт
не HTTP-first. Аналог той самий: «Правило залежностей» +
`.claude/rules/product-safety.md`. Якщо колись у репо зʼявиться реальний
backend-service — цей список заслуговує власного рядка в `CLAUDE.md`, не
лише тут.

## Protocol

Той самий каркас, що курсовий скіл (кроки 1-8), з переписаними кроками під
власні дефолти. Кроки, де логіка ідентична, позначені «= курсовий».

1. **Gate + вид інтерфейсу + read** (= курсовий механізм, власна таблиця
   форм вище). `test -f PRD.md` → відмова, якщо нема. Читати `target_surfaces`
   з `sad.md` frontmatter **першим** — не передеривовувати з
   `architecture-map.md`, якщо воно вже задекларовано. Fallback лише коли
   поле порожнє чи `sad.md` відсутній. Визначити сценарій A/B за наявністю
   `data-model.md`.
2. **Копіювати шаблон.** [`templates/events.md`](templates/events.md) для
   `worker`, [`templates/openapi.yaml`](templates/openapi.yaml) для
   `backend-service`. Немає інтерфейсу → шаблон не копіюється, лише
   одно-рядкова нотатка в звіті (крок 7).
3. **Derive схеми** (= курсовий: кожне поле трасується до колонки
   `data-model.md`, ніколи не вигадується без origin). Для events — поля
   `data.*`; для openapi — request/response schemas.
4. **Derive помилки/стани з `sad.md` §6 `alt`-гілок.** Де є межа процесу
   (HTTP-response, event-payload) — унормований `{code, message, details?}`
   (для events — доменне поле, без окремого реєстру, якщо репо жодного не
   має). Де межі процесу нема (`alt`-гілка веде до значення в тій самій
   моделі, не до окремого повідомлення) — мапити на поле стану напряму й
   зафіксувати це мапування явно в звіті (крок 7), не мовчки.
5. **Idempotency & retry** (лише для events/async). Цифри — дослівно з
   §6 retry-нотатки й dead-letter гілки; немає dead-letter гілки в
   scheduled-job без черги → писати «N/A — cron-повтор, немає порогу DLQ»,
   не вигадувати число.
6. **Examples** (= курсовий, де шаблон їх передбачає; `events.md`-шаблон
   курсового скіла вже несе рівно один приклад на подію — тут без змін).
7. **Inline drift-check (обидва напрямки) + sync-звіт.** Той самий
   4-пунктний чекліст, що курсовий (`references у курсовому api-forge`,
   тут не дублюється — механіка ідентична, форма пунктів 2 і 4 адаптована
   під «немає HTTP» вище). Back-feed coverage: кожен AC → ≥1 подія/поле
   стану чи явний Accept-as-is у звіті.
8. **Write + commit + handoff.** Без `spectral lint` за замовчуванням
   (лінтер специфічний для `openapi.yaml`; для events/cli — не пропонувати
   інструмент, якого немає в репо). Той самий формат handoff-блоку, що
   курсовий (`_shared/handoff.md`), наступний крок — `/sdlc-break-tasks <slug>`.

## Codegen — лише коли контракт це `openapi.yaml` (`backend-service`-гілка)

Немає в типовому прогоні цього репо (events/cli) — типи йдуть напряму з
`data-model.md`, генерувати нема з чого без `openapi.yaml`. Коли контракт
таки `openapi.yaml`: репо TypeScript-only (`app/lib/**`, `CLAUDE.md`
«Правило залежностей»), команда —

```bash
npx openapi-typescript docs/features/<slug>/contracts/openapi.yaml \
  -o docs/features/<slug>/contracts/openapi.d.ts
```

- `--immutable-types` — якщо схема немутабельна (response/event DTO, не
  форма для запису).
- Очікуваний цикл: навмисно неправильно використати згенерований тип у
  ручному коді → `tsc --noEmit` падає з конкретною помилкою типу → виправити
  використання (не тип) → `tsc --noEmit` проходить.
- `oapi-codegen` (Go, `-package handlers -generate types,server` з
  курсового прикладу) — **не застосовний до цього репо**: тут немає жодного
  Go-коду (`docs/architecture-map.md`). Лишено тут заради повноти списку
  стеків, не як команда для копіювання.

## Definition of Done

Той самий каркас, що курсовий (форма контракту відповідна
`target_surfaces`, кожне поле трасується до `data-model.md` або має явний
inferred-origin, `unresolved_origins` порожньо в сценарії A), плюс:
- Немає `BearerAuth`/cursor-пагінації/`/api/v1/` там, де фіча — не
  `backend-service`, без явного обґрунтування чому вони таки потрібні.
- Немає codegen-кроку в звіті, якщо немає `openapi.yaml`.
- Кожна `alt`-гілка §6 має явне мапування (подія, поле стану, або
  Accept-as-is) — жодна не випадає мовчки.

## Anti-patterns

Той самий список, що курсовий (контракт написаний вручну й підігнана
модель під нього, пропущений drift-check, помилки лише з PRD без §6,
вигаданий field без origin, stack-специфічні назви схем/кодів, вільнотекстові
помилки, `?v=2`, `nullable: true` 3.0-стилю, offset pagination, реальний PII),
плюс:
- **Мовчки застосовувати `BearerAuth`/cursor-пагінацію/codegen-крок до
  фічі, що не `backend-service`.** Ці дефолти курсового скіла — для HTTP,
  не універсальні; застосування їх «про всяк випадок» до worker/cli — той
  самий запах, що «індекс про всяк випадок» у `migrations-forge`.
- **Вигадувати error-code реєстр, якого в репо немає.** Писати «no error
  registry found», як каже й курсовий скіл (`references/drift-check.md`),
  не імпровізувати формат.
- **Пропускати codegen мовчки без пояснення в звіті.** N/A — це рядок у
  звіті з причиною, не тиша.

## Templates

→ [`templates/events.md`](templates/events.md) — форма за замовчуванням
для `worker` (структура курсового шаблону, без власних правок — сама
структура вже репо-нейтральна, дефолти застосовуються при заповненні, не
в шаблоні).
→ [`templates/openapi.yaml`](templates/openapi.yaml) — другорядна гілка
для майбутньої `backend-service`-фічі, з власними дефолтами вписаними
inline (без `BearerAuth` за замовчуванням, без cursor-пагінації як
обов'язкової — обидва стають активними, коли фіча дійсно має HTTP-поверхню).
