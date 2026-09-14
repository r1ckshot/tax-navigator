import { describe, expect, it } from 'vitest';
import { evaluateHealth, type HealthInput } from './health';
import { defaultState, type CycleReport, type CycleState } from './state';

const HOUR = 60 * 60 * 1000;
const W38_MOMENT = Date.parse('2026-09-14T06:00:00Z'); // понеділок 06:00 UTC
const LONG_AGO = new Date(W38_MOMENT - 30 * 24 * HOUR);

function report(weekOf: string, status: CycleReport['status'], finishedAt: string): CycleReport {
  return { weekOf, status, startedAt: finishedAt, finishedAt, chats: [], failures: [] };
}

function stateWith(...reports: CycleReport[]): CycleState {
  const state = defaultState();
  for (const r of reports) {
    state.cycleRuns[r.weekOf] = { weekOf: r.weekOf, startedAt: r.startedAt };
  }
  return { ...state, reports: Object.fromEntries(reports.map((r) => [r.weekOf, r])) };
}

function input(overrides: Partial<HealthInput>): HealthInput {
  return {
    now: new Date(W38_MOMENT + HOUR),
    processStartedAt: LONG_AGO,
    schedule: { weekday: 1, hourUtc: 6 },
    state: stateWith(report('2026-W38', 'completed', '2026-09-14T06:20:00.000Z')),
    stateError: null,
    telegramConnected: true,
    ...overrides,
  };
}

describe('evaluateHealth', () => {
  it('усе на місці → ok, звіт показує останній цикл', () => {
    const result = evaluateHealth(input({}));
    expect(result).toEqual({
      ok: true,
      problems: [],
      weekOf: '2026-W38',
      lastCycle: { weekOf: '2026-W38', status: 'completed', finishedAt: '2026-09-14T06:20:00.000Z' },
    });
  });

  it('файл стану не читається → state_unreadable, решта станових перевірок не вгадується', () => {
    const result = evaluateHealth(input({ state: null, stateError: 'EACCES' }));
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(['state_unreadable']);
  });

  it('Telegram відвалився → telegram_disconnected, навіть коли цикл тижня вже пройшов', () => {
    expect(evaluateHealth(input({ telegramConnected: false })).problems).toEqual(['telegram_disconnected']);
  });

  it('цикл цього тижня не відбувся за 2 години після моменту → cycle_overdue', () => {
    const state = stateWith(report('2026-W37', 'completed', '2026-09-07T06:20:00.000Z'));
    // Межа включна: рівно 06:00 + 2 год уже прострочення, за мілісекунду до — ні.
    expect(evaluateHealth(input({ state, now: new Date(W38_MOMENT + 2 * HOUR - 1) })).ok).toBe(true);
    expect(evaluateHealth(input({ state, now: new Date(W38_MOMENT + 2 * HOUR) })).problems).toEqual(['cycle_overdue']);
  });

  it('до моменту тижня відсутній цикл W38 не прострочення: минулий тиждень оброблено', () => {
    const state = stateWith(report('2026-W37', 'completed', '2026-09-07T06:20:00.000Z'));
    expect(evaluateHealth(input({ state, now: new Date(W38_MOMENT - HOUR) })).ok).toBe(true);
  });

  it('процес перезапущено у вівторок — 2 години відліку від старту, а не від понеділка', () => {
    const state = stateWith(report('2026-W37', 'completed', '2026-09-07T06:20:00.000Z'));
    const tuesday = W38_MOMENT + 28 * HOUR;
    expect(evaluateHealth(input({ state, processStartedAt: new Date(tuesday), now: new Date(tuesday + HOUR) })).ok).toBe(true);
    expect(evaluateHealth(input({ state, processStartedAt: new Date(tuesday), now: new Date(tuesday + 3 * HOUR) })).problems).toEqual([
      'cycle_overdue',
    ]);
  });

  it('останній цикл failed (жоден чат не прочитано) → last_cycle_failed, хоч тиждень формально оброблено', () => {
    const state = stateWith(
      report('2026-W37', 'completed', '2026-09-07T06:20:00.000Z'),
      report('2026-W38', 'failed', '2026-09-14T06:01:00.000Z')
    );
    expect(evaluateHealth(input({ state })).problems).toEqual(['last_cycle_failed']);
  });

  it('partial не валить здоров’я: недоступний чат названо у звіті, а не приховано', () => {
    const state = stateWith(report('2026-W38', 'partial', '2026-09-14T06:20:00.000Z'));
    expect(evaluateHealth(input({ state })).ok).toBe(true);
  });
});
