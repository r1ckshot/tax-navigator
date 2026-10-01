# 08 · Адреси `/uk/poland/` і каркас мов

Тема 2.1 · сесія 1 з 1 · гілка `feat/locale-routing` · Opus · high

## Мета

Продукт живе за адресами `/uk/poland/…`, каркас мов готовий прийняти `en` без
переробки, старі адреси й уже розіслані share-лінки відкривають той самий результат.

## Прочитати

- DECISIONS 2026-10-01 (Європа: адреси, мови, без редиректу за IP)
- ARCHITECTURE.md; `docs/architecture-map.md`; `docs/adr/`
- `app/` (маршрути), `app/lib/share.ts`, `app/lib/storage.ts`, `app/lib/i18n/uk.ts`, `next.config.mjs`, `visual/screens.spec.ts`

## Кроки

1. `map-architecture`, якщо `reflects_commit` карти відстав від `master`.
2. Структура маршрутів (динамічні сегменти `[locale]/[country]` або статичні
   `uk/poland` зі `generateStaticParams`) — рішення + ADR у `docs/adr/` (зміна
   незворотна для URL і чіпає кілька модулів).
3. Словники: завантаження за мовою; `en` — порожній каркас, не показується.
   Тест: кожен ключ `uk` присутній у кожній увімкненій мові.
4. Редиректи в `next.config.mjs`:
   - `/` → `/uk/poland/` тимчасовим 307, бо `/` стане лендінгом бренду в темі 2.2;
   - `/questionnaire` → `/uk/poland/questionnaire` постійним 308, query і fragment
     зберігаються — від цього живуть share-лінки;
   - `/sources` → `/uk/poland/sources`; `/tokens` лишається технічною сторінкою.
5. `<html lang>`, canonical, заготовка hreflang (`uk` + `x-default`); базова адреса
   з env, щоб тема 5.1 змінила лише змінну.
6. Тести: share round-trip на нових адресах; старий лінк із query відкриває той
   самий результат (Playwright на CI); архітектурні тести; шляхи у `screens.spec.ts`.
7. Версія minor (адреси видимі ззовні): `package.json` + CHANGELOG →
   `gh pr ready` → мердж.

## Агенти й скіли

- `map-architecture` (делегує `explorer`)
- `diff-reviewer`, `feature-ship`

## Крок Mike

Перевірити на превʼю: старе посилання на результат, яке в тебе є, відкривається.

## Готово коли

- [ ] ADR записано; `npm test`, `npm run test:ui`, `npm run verify` зелені
- [ ] Старий share-лінк і `/questionnaire?…` ведуть на той самий результат (тест на CI)
- [ ] `en` вмикається додаванням словника, без змін у маршрутах (показано тестом)
- [ ] CHANGELOG і версія; PR злитий
