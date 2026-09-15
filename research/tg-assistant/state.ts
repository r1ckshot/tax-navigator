/**
 * Тижневий стан циклу збору (ADR-0003 — локальний JSON-файл, не БД).
 *
 * Дві незалежні ідемпотентності:
 *  - cycle_runs.week_of — чи цей тиждень уже оброблено (гейт усього циклу).
 *  - UNIQUE(chat_id, telegram_message_id) — дедуп конкретних повідомлень при
 *    catch-up (AC-09): повторний прогін для того самого тижня не додає других
 *    рядків, навіть якщо batch повідомлень прийшов ще раз повністю.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Маркер catch-up на чат (AC-09): з якого моменту читати наступного разу.
 * Окремо від `cycleRuns`, бо чат, що впав у dead-letter цього тижня, мусить
 * наступного тижня дочитати й цей проміжок, а не почати з нового циклу.
 */
export interface ChatMarker {
  ref: string;
  title: string;
  firstReadAt: string;
  lastReadAt: string;
}

/**
 * Тижневий звіт збору — лише похідні дані, без тексту повідомлень
 * (PRD §6.1: сирий текст на диск не пишеться).
 */
export interface CycleReport {
  weekOf: string;
  status: 'completed' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string;
  chats: Array<{ ref: string; title: string; newMessages: number; windowStartAt: string | null }>;
  failures: Array<{ ref: string; title: string | null; reason: string }>;
}

export interface CycleState {
  cycleRuns: Record<string, { weekOf: string; startedAt: string }>;
  seenMessages: Record<string, true>;
  chats?: Record<string, ChatMarker>;
  reports?: Record<string, CycleReport>;
}

export function defaultState(): CycleState {
  return { cycleRuns: {}, seenMessages: {} };
}

/** Останній звіт за `finishedAt`, або null, якщо циклів ще не було. */
export function latestReport(state: CycleState): CycleReport | null {
  const reports = Object.values(state.reports ?? {});
  if (reports.length === 0) return null;
  return reports.reduce((a, b) => (a.finishedAt >= b.finishedAt ? a : b));
}

export function loadState(filePath: string): CycleState {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as CycleState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return defaultState();
    throw err;
  }
}

/**
 * Atomic write (tmp-файл + rename) — ADR-0003, Negative: без цього аварійне
 * вимкнення посеред запису лишає файл у проміжному стані, і AC-09 дедуп
 * ризикує чорнетковим станом.
 */
export function saveState(filePath: string, state: CycleState): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  renameSync(tmpPath, filePath);
}

export function hasCycleRun(state: CycleState, weekOf: string): boolean {
  return weekOf in state.cycleRuns;
}

/** Ідемпотентне: повторний виклик для того самого weekOf не змінює startedAt. */
export function recordCycleRun(state: CycleState, weekOf: string): CycleState {
  if (hasCycleRun(state, weekOf)) return state;
  return {
    ...state,
    cycleRuns: {
      ...state.cycleRuns,
      [weekOf]: { weekOf, startedAt: new Date().toISOString() },
    },
  };
}

function messageKey(chatId: string, telegramMessageId: number): string {
  return `${chatId}:${telegramMessageId}`;
}

/**
 * Фільтрує batch повідомлень чату до тих, що ще не бачені (UNIQUE(chat_id,
 * telegram_message_id)), і одразу позначає їх баченими в поверненому стані.
 * Той самий batch, прогнаний повторно для того самого чату, дає newIds: [].
 */
export function dedupMessages(
  state: CycleState,
  chatId: string,
  telegramMessageIds: readonly number[]
): { newIds: number[]; state: CycleState } {
  const newIds: number[] = [];
  const seenMessages = { ...state.seenMessages };

  for (const id of telegramMessageIds) {
    const key = messageKey(chatId, id);
    if (key in seenMessages) continue;
    seenMessages[key] = true;
    newIds.push(id);
  }

  return { newIds, state: { ...state, seenMessages } };
}
