# evidence-guard — MCP-сервер і канал поверх rules-as-data

Капстоун Module 8 (MCP) курсу Agentic Engineering, зроблений на домені цього
репозиторію, а не на навчальному task-store.

**Що робить.** Віддає моделі не цифри «взагалі», а **метадані довіри до цифр**:
яке правило звідки взяте, коли востаннє звірене з офіційним джерелом і чи не
пора звіряти знову. Це рівно те, чого вимагає
[`.claude/rules/evidence-numbers.md`](../../.claude/rules/evidence-numbers.md):
жодна цифра не береться з пам'яті моделі.

**Два режими одного домену:**

| Файл | Режим | Хто ініціює |
|---|---|---|
| `dist/server.js` | звичайний MCP-сервер на stdio | модель кличе tool |
| `dist/channel.js` | канал (`claude/channel`) + `POST /webhook` | зовнішня подія сама лізе в сесію |

## Примітиви

**Tools**

| Tool | Навіщо | Контракт помилки |
|---|---|---|
| `list_rules` | які правила існують і які протерміновані; **без цифр** | — |
| `get_rule` | параметри одного правила + `source_url` + `verified_at` | невідомий `rule_id` → `isError` з підказкою «виклич `list_rules`, не вигадуй цифру» |
| `check_freshness` | зведення свіжості; має `outputSchema` і повертає `structuredContent` | зламаний `structuredContent` ловить сам SDK (див. `make inspect-broken`) |
| `ack_event` (лише в каналі) | закрити подію каналу вердиктом | невідомий `event_id` → `isError` |

**Resource** — `evidence://summary`: скільки правил, скільки протерміновано, які саме.

**Prompt** — `verify-rule <rule_id>`: розгортає протокол перезвірки з
`evidence-numbers.md` у кроки для конкретного правила, з підставленим джерелом.

## Швидкий старт

```bash
make install
make test        # 50 тестів: store, MCP-шар через InMemoryTransport, вебхук, канал
make build
make inspect     # tools/list через Inspector CLI
make contract    # три контрактні однорядники з exit-кодами
```

Сервер уже прописаний у кореневому `.mcp.json` проєкту як `evidence-guard`
(шлях `mcp/evidence-guard/dist/server.js`) — після `make build` він видимий
у `claude mcp list`.

## Канал і вебхук

```bash
make channel                      # підняти канал standalone (порт 8790)
make webhook-noauth               # → 401 unauthorized
make webhook-ok                   # → 202 accepted
make webhook-injection            # → 202, але текст події знезброєний
```

Живий прогін у сесії Claude Code — з **цієї** теки: тут свій `.mcp.json`, де
імʼя `evidence-guard` вказує на `dist/channel.js`. У кореневому `.mcp.json` те
саме імʼя — це звичайний сервер (`dist/server.js`), який capability каналу не
оголошує, тож із кореня прапорець канал не підніме.

```bash
cd mcp/evidence-guard
EVIDENCE_GUARD_TOKEN=local-dev-token \
  claude --dangerously-load-development-channels server:evidence-guard
```

Подія з вебхука виринає в сесії тегом `<channel source="evidence-guard">`.

> **Два різні гейти, які легко переплутати.**
> 1. `Channels are not currently available` — це **org policy**, не телеметрія:
>    CLI чекає `channelsEnabled: true` у *managed settings*
>    (`/etc/claude-code/managed-settings.json`), і жодна правка
>    `.claude/settings.json` цього не замінює.
> 2. `server did not declare claude/channel capability` / прапорець
>    проігноровано — сесію запущено не з цієї теки, тож імʼя веде на
>    `dist/server.js`.
>
> Без `EVIDENCE_GUARD_TOKEN` канал піднімається, але **порт не відкривається
> взагалі** — щоденна сесія не тримає слухача. Якщо порт усе ж зайнятий іншим
> процесом, вебхук просто не піднімається (рядок у stderr), а MCP-сервер лишається
> живим — інакше клієнт бачив би `CONNECTION_CLOSED` замість зрозумілої причини.

## Три запобіжники на недовіреному вході

Тіло вебхука лягає **прямо в контекст моделі**, тож воно — чужий текст, а не
дані від свого сервісу. Реалізація — [`src/webhook.ts`](src/webhook.ts):

1. **Спільний секрет** у заголовку `x-evidence-token`, порівняння
   `timingSafeEqual`, **fail closed**: не заданий `EVIDENCE_GUARD_TOKEN` —
   канал відмовляє всім (`503`), а не «працює без перевірки».
2. **Схема-allowlist** (`z.strictObject`): у подію потрапляють лише
   `source` / `rule_id` / `url` / `changed_at` / `note`. Невідоме поле валить
   увесь запит; `url` мусить бути `https` на `zus.pl` чи `podatki.gov.pl`.
3. **Санітизація тексту**: кутові дужки, переноси рядка й керуючі символи
   зникають, довжина обрізається. Інакше `note` може підробити закриття тегу
   `</channel>` і виглядати як системна інструкція.

Плюс: слухаємо тільки `127.0.0.1`, тіло понад 8 КБ → `413`.

**Про поле `pushed` у відповіді.** `pushed: true` означає «нотифікацію
відправлено в транспорт сесії», а не «людина її побачила»: stdio-транспорт
приймає запис навіть тоді, коли на іншому кінці ніхто не читає. Чесніше цього
з боку сервера не скажеш — підтвердження живе в самій сесії.

## Межа з рештою репо

- `src/store.ts` не імпортує нічого з MCP SDK — той самий принцип, що
  `app/lib/calc/` тримає проти react/next.
- Поріг «протерміноване» дублює `scripts/check-stale-rules.mjs` (той годує
  SessionStart-хук). Дублювання свідоме і прикрите **тестом парності**: якщо
  пороги розійдуться, хук і сервер почнуть казати людині різне — тест упаде.
- Сервер нічого не пише в `app/lib/rules/` — тільки читає. Єдиний запис —
  `data/acks.json` (вердикти по подіях каналу).
