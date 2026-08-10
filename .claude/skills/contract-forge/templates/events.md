<!-- Template for contract-forge — копіюється в docs/features/<slug>/contracts/events.md для -->
<!-- target_surfaces: ["worker"] (типовий випадок у цьому репо) або коли sad.md §6 має async- -->
<!-- ознаку (retry-нотатка чи async-актор) на synchronous-у поверхні. Один блок `## Event` на -->
<!-- async-повідомлення в потоках. Назви подій — доменна мова з data-model.md, не ідіома -->
<!-- брокера/бібліотеки. Якщо producer і consumer — той самий локальний процес (типово для -->
<!-- worker/cli цього репо, без message-bus) — задокументувати це прямо в Channel, не -->
<!-- прикидатись класичним pub/sub. -->
---
status: Draft
owner: "<Backend Lead>"
reviewers: []
updated_at: "<YYYY-MM-DD>"
feature_size: M
---

# Events — <feature>

Async-контракт для потоків `sad.md` §6. Кожна подія — опублікований факт;
споживачі його читають. Як і openapi-контракт, це **похідне** з
послідовностей — кожна подія тут відповідає enqueue/deliver повідомленню
чи scheduled-тригеру в діаграмі §6.

## Channel: `<channel-name>`

- **Producer:** `<building block, що володіє потоком>` — якщо це той самий
  процес, що й consumer (типово для worker без message-bus), написати прямо.
- **Consumers:** `<список сервісів/джобів, що підписані>` — або «немає
  зовнішнього підписника» для self-contained script.
- **Delivery:** at-least-once | exactly-once.
- **Ordering:** ключ-based (по `<field>`) | немає.

## Event: `<module>.<action>.v<N>`

<!-- Назва = нейтральна конвенція module.action.vN. Конверт віддзеркалює дух HTTP-error-моделі: -->
<!-- маленька, стабільна, машинно-читана «шапка» + типізований `data`-блок. -->

```json
{
  "event_id": "<uuid>",
  "event_type": "<module>.<action>",
  "version": <N>,
  "occurred_at": "<iso8601>",
  "data": {
    "<field>": "<type — трасується до колонки data-model.md, де вона є>"
  }
}
```

- **Required fields:** `<event_id, event_type, version, occurred_at, ...>`.
- **Origin:** `sad.md` §6 `<назва потоку>` → повідомлення `<enqueue ...>`.
- **Backwards-compat policy:** тільки додавання — нове опційне поле ОК;
  видалення/перейменування — нова версія (`v<N+1>`). Споживачі ігнорують
  невідомі поля.

## Idempotency & retry

<!-- Цифри — з §6 retry-нотатки й dead-letter гілки, не вигадувати. -->

- **Idempotency:** споживачі дедуплікують по `event_id` (redelivery несе
  той самий id) — або власний ключ моделі (напр. UNIQUE-колонка), якщо
  фіча його вже має; вказати, який саме.
- **Retry:** `<N>` спроб з exponential backoff — або «наступний scheduled
  запуск» для cron-based worker без черги (типово для цього репо).
- **Dead-letter:** маршрут у `<channel-name>.dlq` після `<N>` невдалих
  спроб — або «N/A, немає порогу DLQ» для cron-повтору без черги.

## Schema registry

- Registry: `<url / шлях у репо>` — або «N/A, `data-model.md` тут же є
  канонічним джерелом» (типово, коли немає окремого брокера).
- Validator: `<інструмент, який репо вже використовує>` — виявити, не
  припускати.
