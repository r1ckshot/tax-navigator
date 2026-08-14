---
id: ac02-chat-filter
epic: tg-assistant
parent: S-1 (Step 1, AC-02 slice)
project: tax-navigator
status: todo
context_budget: ~1200 tokens
created: 2026-08-14
---

# ac02-chat-filter · Never collect from chats the researcher never joined (AC-02)

Урок 7.7 (TDD discipline) — комплексний рівень, story 2. Витягнута з
[[../../../docs/features/tg-assistant/tasks/S-1-tg-assistant.md|S-1 Step 1]] як
pure-function частина: реальний MTProto-запит (ADR-0001) залишається поза
скоупом — тут лише фільтр кандидатів-чатів проти списку вже приєднаних, який
Step 1 називає "AC-02 гейтиться на рівні запиту".

## Interface

```ts
export function filterKnownChats(
  candidateChatIds: readonly string[],
  knownChatIds: readonly string[]
): string[]
```

## Rules (specification)

Джерело: S-1 AC-02 — "Given чат, до якого дослідник ніколи не приєднувався,
when цикл формує список чатів для обходу, then система ніколи не включає цей
чат і не показує його в звіті."

- Повертає лише ті `candidateChatIds`, що присутні в `knownChatIds` — точний
  збіг рядка, без normalization (case/trim).
- Порядок результату — той самий відносний порядок, що в `candidateChatIds`.
- Невідомі чати **не потрапляють у результат взагалі** — на відміну від
  AC-08 (retryQueue), тут немає "звіту про відкинуте": AC-02 явно каже
  "не показує його в звіті", не "показує причину відкидання".

## Acceptance criteria (GWT)

- **AC-02.1:** Given candidates, усі з яких є в known, when фільтруємо, then результат — той самий список у тому самому порядку.
- **AC-02.2:** Given candidates з одним чатом, якого нема в known, when фільтруємо, then цей чат відсутній у результаті.
- **AC-02.3:** Given змішаний список (частина known, частина ні), when фільтруємо, then у результаті лишаються лише known, у вихідному відносному порядку.
- **AC-02.4:** Given порожній candidates, when фільтруємо, then результат — порожній масив (не помилка).
- **AC-02.5:** Given порожній known (дослідник ще нікуди не приєднався), when фільтруємо будь-які candidates, then результат — порожній масив.
- **AC-02.6 (anti-regression pitfall):** Given known містить `"chat-1"`, when candidates містить `"Chat-1"` (інший регістр) або `" chat-1"` (пробіл), then жоден із цих варіантів НЕ проходить фільтр — точний збіг рядка, не "схожий".

## Conventions (стек цього репо)

- Файли: `research/tg-assistant/chatFilter.ts` (реалізація) + `research/tg-assistant/chatFilter.test.ts` (колоковано).
- Test command: `npx vitest run --config research/tg-assistant/vitest.config.ts`.
- Commit: Conventional Commits, англійською, з обов'язковим трейлером `Co-Authored-By: Claude <модель> <noreply@anthropic.com>` останнім рядком тіла.
- Scope у commit-типі: `tg-assistant-chat-filter`.
- Не міняти цей файл і не міняти тестовий файл після фази RED.
