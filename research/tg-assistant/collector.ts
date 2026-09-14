/**
 * Тижневий цикл збору (S-1): AC-01, AC-02, AC-08, AC-09, AC-10.
 *
 * Мережі тут немає — Telegram приходить через `TelegramPort` (адаптер gramjs у
 * telegram.ts, ADR-0001), а час і сон — через ін'єкцію. Тому весь цикл, разом
 * із чергою FLOOD_WAIT, перевіряється тестом без живого акаунта.
 *
 * Текст повідомлень живе лише в пам'яті (`messages` у результаті) і далі йде
 * фільтру S-2. На диск через стан потрапляють id, маркери і звіт.
 */

import { filterKnownChats } from './chatFilter.ts';
import { decideChatRetry, type FloodWaitAttempt } from './retryQueue.ts';
import { isoWeek } from './schedule.ts';
import {
  dedupMessages,
  hasCycleRun,
  recordCycleRun,
  type ChatMarker,
  type CycleReport,
  type CycleState,
} from './state.ts';
import { applyBackfillWindow } from './window.ts';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface JoinedChat {
  /** id діалогу Telegram як рядок (`-100…` для супергруп). */
  id: string;
  username: string | null;
  title: string;
  /** Дата створення чату (для каналів/супергруп — з entity), ISO. */
  createdAt: string;
}

export interface RawMessage {
  telegramMessageId: number;
  postedAt: string;
  text: string;
}

export type ReadFailure =
  | { kind: 'flood_wait'; seconds: number }
  | { kind: 'access_lost'; code: string }
  | { kind: 'failed'; code: string };

/** Адаптер зводить помилки MTProto до трьох видів, які цикл уміє розрізняти. */
export class TelegramReadError extends Error {
  failure: ReadFailure;

  constructor(failure: ReadFailure) {
    super(failure.kind === 'flood_wait' ? `FLOOD_WAIT_${failure.seconds}` : failure.code);
    this.failure = failure;
  }
}

export interface TelegramPort {
  /** Лише діалоги, де акаунт учасник, — чужого чату Telegram сюди не віддасть. */
  listJoinedChats(): Promise<JoinedChat[]>;
  /** Повідомлення чату, опубліковані не раніше `since` (ISO). */
  readMessagesSince(chatId: string, since: string): Promise<RawMessage[]>;
}

export interface CollectedMessage extends RawMessage {
  chatId: string;
  weekOf: string;
}

export interface RunCycleInput {
  port: TelegramPort;
  state: CycleState;
  /** Нормалізовані ключі з конфігу (config.ts `normalizeChatRef`). */
  targets: readonly string[];
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  windowWeeks: number;
  maxFloodWaitSeconds: number;
}

export type RunCycleResult =
  | { skipped: true; weekOf: string }
  | { skipped: false; weekOf: string; state: CycleState; report: CycleReport; messages: CollectedMessage[] };

interface QueueEntry {
  key: string;
  chat: JoinedChat;
  attempts: FloodWaitAttempt[];
  notBeforeMs: number;
}

function joinedKeys(chat: JoinedChat): string[] {
  return chat.username ? [chat.id, chat.username.toLowerCase()] : [chat.id];
}

function describeFailure(failure: ReadFailure, attempts: readonly FloodWaitAttempt[], maxFloodWaitSeconds: number): string | null {
  if (failure.kind === 'access_lost') return `access_lost (${failure.code})`;
  if (failure.kind === 'failed') return `read_failed (${failure.code})`;
  if (failure.seconds > maxFloodWaitSeconds) {
    return `FLOOD_WAIT_X=${failure.seconds}s exceeds the per-cycle limit of ${maxFloodWaitSeconds}s; moving to dead letter queue`;
  }
  const outcome = decideChatRetry(attempts, failure.seconds);
  return outcome.action === 'dead_letter' ? outcome.reason : null;
}

function reportStatus(chatsRead: number, failures: number): CycleReport['status'] {
  // Нуль прочитаних чатів — не «тихий тиждень», а збій: інакше звіт показав би
  // правдоподібний нуль (AC-08).
  if (chatsRead === 0) return 'failed';
  return failures === 0 ? 'completed' : 'partial';
}

export async function runCycle(input: RunCycleInput): Promise<RunCycleResult> {
  const startedAt = input.now();
  const weekOf = isoWeek(startedAt);
  if (hasCycleRun(input.state, weekOf)) return { skipped: true, weekOf };

  const startedIso = startedAt.toISOString();
  const markers: Record<string, ChatMarker> = { ...(input.state.chats ?? {}) };
  let state: CycleState = input.state;

  const joined = await input.port.listJoinedChats();
  const byKey = new Map<string, JoinedChat>();
  for (const chat of joined) for (const key of joinedKeys(chat)) byKey.set(key, chat);

  // AC-02: у чергу йдуть лише цілі, де акаунт учасник. Ціль без членства й без
  // історії читання не з'являється ні в черзі, ні у звіті.
  const accessible = filterKnownChats(input.targets, [...byKey.keys()]);
  const failures: CycleReport['failures'] = [];
  const knownByRef = new Map(Object.values(markers).map((m) => [m.ref, m]));
  for (const target of input.targets) {
    if (accessible.includes(target)) continue;
    const previous = knownByRef.get(target);
    // AC-08: раніше читаний чат зник зі списку діалогів — виключили, видалили, закрили.
    if (previous) failures.push({ ref: target, title: previous.title, reason: 'access_lost (no longer in dialogs)' });
  }

  // Той самий чат, названий у конфігу і username-ом, і id, читається один раз.
  const queuedIds = new Set<string>();
  const queue: QueueEntry[] = [];
  for (const key of accessible) {
    const chat = byKey.get(key) as JoinedChat;
    if (queuedIds.has(chat.id)) continue;
    queuedIds.add(chat.id);
    queue.push({ key, chat, attempts: [], notBeforeMs: 0 });
  }
  const chats: CycleReport['chats'] = [];
  const messages: CollectedMessage[] = [];
  const windowStartIso = new Date(startedAt.getTime() - input.windowWeeks * WEEK_MS).toISOString();

  while (queue.length > 0) {
    const nowMs = input.now().getTime();
    const readyIndex = queue.findIndex((entry) => entry.notBeforeMs <= nowMs);
    if (readyIndex === -1) {
      // ADR-0002: чекаємо лише тоді, коли всі решта чатів самі на паузі.
      await input.sleep(Math.min(...queue.map((entry) => entry.notBeforeMs)) - nowMs);
      continue;
    }
    const [entry] = queue.splice(readyIndex, 1);
    const marker = markers[entry.chat.id];
    const since = marker && marker.lastReadAt > windowStartIso ? marker.lastReadAt : windowStartIso;

    let raw: RawMessage[];
    try {
      raw = await input.port.readMessagesSince(entry.chat.id, since);
    } catch (err) {
      const failure: ReadFailure =
        err instanceof TelegramReadError ? err.failure : { kind: 'failed', code: err instanceof Error ? err.name : 'unknown' };
      const reason = describeFailure(failure, entry.attempts, input.maxFloodWaitSeconds);
      if (reason === null && failure.kind === 'flood_wait') {
        entry.attempts.push({ floodWaitSeconds: failure.seconds });
        entry.notBeforeMs = input.now().getTime() + failure.seconds * 1000;
        queue.push(entry);
      } else {
        failures.push({ ref: entry.key, title: entry.chat.title, reason: reason as string });
      }
      continue;
    }

    // AC-10: вікно й межа вікна — лише для першого читання чату. Відомий чат, що
    // простояв довше за вікно, теж обрізається, і межу так само названо.
    let windowStartAt: string | null = null;
    if (!marker) {
      const windowed = applyBackfillWindow({ chatCreatedAt: entry.chat.createdAt, now: startedIso, windowWeeks: input.windowWeeks, messages: raw });
      const kept = new Set(windowed.messages.map((m) => m.telegramMessageId));
      raw = raw.filter((m) => kept.has(m.telegramMessageId));
      windowStartAt = windowed.windowStartAt;
    } else if (since === windowStartIso) {
      windowStartAt = windowStartIso;
    }

    // AC-09: той самий (chat_id, telegram_message_id) удруге не проходить.
    const dedup = dedupMessages(state, entry.chat.id, raw.map((m) => m.telegramMessageId));
    state = dedup.state;
    const fresh = new Set(dedup.newIds);
    for (const m of raw) if (fresh.has(m.telegramMessageId)) messages.push({ ...m, chatId: entry.chat.id, weekOf });

    // Маркер ставиться на старт циклу, не на фініш: повідомлення, що прийшли під
    // час читання, наступний прогін перечитає, а дедуп відкине перетин.
    markers[entry.chat.id] = { ref: entry.key, title: entry.chat.title, firstReadAt: marker?.firstReadAt ?? startedIso, lastReadAt: startedIso };
    chats.push({ ref: entry.key, title: entry.chat.title, newMessages: dedup.newIds.length, windowStartAt });
  }

  const report: CycleReport = {
    weekOf,
    status: reportStatus(chats.length, failures.length),
    startedAt: startedIso,
    finishedAt: input.now().toISOString(),
    chats,
    failures,
  };
  state = recordCycleRun({ ...state, chats: markers }, weekOf);
  state = { ...state, reports: { ...(state.reports ?? {}), [weekOf]: report } };

  return { skipped: false, weekOf, state, report, messages };
}
