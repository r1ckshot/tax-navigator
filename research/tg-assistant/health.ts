/**
 * Чесна перевірка здоров'я воркера: не «процес живий», а «процес робить свою
 * роботу». Відповідь на HTTP сама по собі доводить лише живий event loop; решта
 * чотирьох перевірок — що є куди писати, є звідки читати, цикл не прострочено і
 * останній цикл не віддав нуль замість даних.
 */

import { isoWeek, scheduledMoment, type WeeklySchedule } from './schedule.ts';
import { hasCycleRun, latestReport, type CycleReport, type CycleState } from './state.ts';

/** PRD §6: цикл із backfill має вкластися у 2 години — довше вже прострочення. */
export const CYCLE_GRACE_MS = 2 * 60 * 60 * 1000;

export type HealthProblem = 'state_unreadable' | 'telegram_disconnected' | 'cycle_overdue' | 'last_cycle_failed';

export interface HealthInput {
  now: Date;
  processStartedAt: Date;
  schedule: WeeklySchedule;
  /** null — файл стану не прочитався; `stateError` тоді каже чому. */
  state: CycleState | null;
  stateError: string | null;
  telegramConnected: boolean;
}

export interface HealthResult {
  ok: boolean;
  problems: HealthProblem[];
  weekOf: string;
  lastCycle: Pick<CycleReport, 'weekOf' | 'status' | 'finishedAt'> | null;
}

export function evaluateHealth(input: HealthInput): HealthResult {
  const weekOf = isoWeek(input.now);
  const problems: HealthProblem[] = [];

  if (!input.telegramConnected) problems.push('telegram_disconnected');

  if (input.state === null) {
    problems.push('state_unreadable');
    return { ok: false, problems, weekOf, lastCycle: null };
  }

  // Відлік від пізнішого з двох: момент тижня або старт процесу. Інакше
  // перезапуск у вівторок одразу червоніє, хоч цикл щойно стартував.
  const due = Math.max(scheduledMoment(input.now, input.schedule).getTime(), input.processStartedAt.getTime());
  if (!hasCycleRun(input.state, weekOf) && input.now.getTime() >= due + CYCLE_GRACE_MS) {
    problems.push('cycle_overdue');
  }

  const last = latestReport(input.state);
  if (last?.status === 'failed') problems.push('last_cycle_failed');

  return {
    ok: problems.length === 0,
    problems,
    weekOf,
    lastCycle: last ? { weekOf: last.weekOf, status: last.status, finishedAt: last.finishedAt } : null,
  };
}
