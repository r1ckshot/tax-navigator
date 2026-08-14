---
id: step2-retry-queue
epic: tg-assistant
parent: S-1 (Step 2)
project: tax-navigator
status: todo
context_budget: ~1500 tokens
created: 2026-08-14
---

# step2-retry-queue · Per-chat FLOOD_WAIT retry decision (AC-08)

Урок 7.7 (TDD discipline) — комплексний рівень, story 1. Витягнута з
[[../../../docs/features/tg-assistant/tasks/S-1-tg-assistant.md|S-1 Step 2]] як
pure-function частина: сама MTProto-черга (реальні мережеві виклики, ADR-0001/0002)
залишається поза скоупом — тут лише рішення "retry чи dead-letter" для одного чату
на основі історії його попередніх спроб.

## Interface

```ts
export interface FloodWaitAttempt {
  floodWaitSeconds: number; // X із помилки Telegram FLOOD_WAIT_X
}

export interface RetryOutcome {
  action: 'retry' | 'dead_letter';
  waitMs: number | null;   // присутнє лише при action === 'retry'
  reason: string | null;   // присутнє лише при action === 'dead_letter'
}

export function decideChatRetry(
  priorAttempts: readonly FloodWaitAttempt[],
  currentFloodWaitSeconds: number
): RetryOutcome
```

## Rules (specification)

Джерело: [[../../../docs/features/tg-assistant/adr/0002-per-chat-backoff-queue-for-flood-wait.md|ADR-0002]] + AC-08.

- Чекання при retry — **реальний X** з поточної помилки Telegram, не вигадана
  експонента: `waitMs = currentFloodWaitSeconds * 1000`. ADR-0002 explicitly
  каже "читає конкретне значення X із самої помилки", не обчислює власний
  множник.
- **3 поспіль невдалі спроби для того самого чату** (`priorAttempts.length >= 3`)
  → вичерпано, `action = 'dead_letter'`, `waitMs = null`, `reason` — непорожній
  рядок, що явно називає причину (кількість спроб + останнє значення X), не
  generic "failed".
- Менше 3 попередніх спроб → `action = 'retry'`.
- Поріг рахує лише КІЛЬКІСТЬ попередніх спроб для цього чату, не суму/розмір
  `floodWaitSeconds` — великий X на 1-й спробі все одно дає retry, не dead-letter.

## Acceptance criteria (GWT)

- **AC-08.1:** Given чат без попередніх невдалих спроб (`priorAttempts = []`), when приходить `FLOOD_WAIT_X`, then `action = 'retry'` і `waitMs = X * 1000`.
- **AC-08.2:** Given чат із 1 попередньою невдалою спробою, when приходить ще один `FLOOD_WAIT_X`, then `action = 'retry'` (2-га спроба ще не вичерпання).
- **AC-08.3:** Given чат із 2 попередніми невдалими спробами (3-тя приходить зараз), when приходить `FLOOD_WAIT_X`, then `action = 'dead_letter'`, `waitMs = null`, і `reason` — непорожній рядок (не тихий нуль).
- **AC-08.4:** Given той самий вичерпаний випадок (AC-08.3), when читаємо `reason`, then рядок явно містить і кількість вичерпаних спроб, і останнє значення `floodWaitSeconds` — не generic "failed"/"error".
- **AC-08.5:** Given чат із великим `floodWaitSeconds` (напр. 21600 — 6 годин) але лише 0 попередніх спроб, when приходить ця перша помилка, then усе одно `action = 'retry'` — поріг лічить кількість спроб, не розмір X.

## Conventions (стек цього репо)

- Файли: `research/tg-assistant/retryQueue.ts` (реалізація) + `research/tg-assistant/retryQueue.test.ts` (колоковано, не окрема `tests/`-тека).
- Test command: `npx vitest run --config research/tg-assistant/vitest.config.ts`.
- Commit: Conventional Commits, англійською, з обов'язковим трейлером `Co-Authored-By: Claude <модель> <noreply@anthropic.com>` останнім рядком тіла (без нього `pre-commit-gate` хук репо відхилить коміт).
- Scope у commit-типі: `tg-assistant-retry`.
- Не міняти цей файл і не міняти тестовий файл після фази RED — контракт, не пропозиція.
