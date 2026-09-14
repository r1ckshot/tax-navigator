/**
 * Метрики колектора у текстовому форматі Prometheus (урок 11.3), без npm-залежностей.
 *
 * Мітки — лише обмежені набори: статус циклу і вид збою. Ні назви чату, ні
 * username, ні тексту: перше роздуло б кардинальність, друге суперечить
 * PRD §6.1. Чат, що впав, названо у звіті циклу в state.json, не тут.
 *
 * Два роди чисел. Лічильники й гістограми живуть у пам'яті процесу і
 * обнуляються на рестарті — це нормальна поведінка Prometheus-лічильника.
 * Числа останнього циклу читаються зі state.json при кожному запиті, тож цикл
 * раз на тиждень лишається видимим і після деплою посеред тижня.
 */

import type { HealthResult } from './health.ts';
import type { CycleReport } from './state.ts';

/** Одне читання чату: від частки секунди до хвилин під FLOOD_WAIT-паузами Telegram. */
export const CHAT_READ_BUCKETS_SECONDS = [0.5, 1, 2, 5, 10, 30, 60, 120] as const;
/** Цикл цілком: стеля PRD §6 — 2 години. */
export const CYCLE_BUCKETS_SECONDS = [60, 300, 900, 1800, 3600, 7200] as const;

export type FailureKind = 'access_lost' | 'read_failed' | 'flood_wait';
const FAILURE_KINDS: readonly FailureKind[] = ['access_lost', 'read_failed', 'flood_wait'];
const CYCLE_STATUSES: readonly CycleReport['status'][] = ['completed', 'partial', 'failed'];

/** Причина у звіті — вільний рядок (collector.ts `describeFailure`); мітка — лише її вид. */
export function failureKind(reason: string): FailureKind {
  if (reason.startsWith('access_lost')) return 'access_lost';
  if (reason.startsWith('read_failed')) return 'read_failed';
  return 'flood_wait';
}

class Histogram {
  private readonly buckets: readonly number[];
  private readonly counts: number[];
  private sum = 0;
  private count = 0;

  constructor(buckets: readonly number[]) {
    this.buckets = buckets;
    this.counts = buckets.map(() => 0);
  }

  observe(value: number): void {
    this.sum += value;
    this.count += 1;
    this.buckets.forEach((le, i) => {
      if (value <= le) this.counts[i] += 1;
    });
  }

  lines(name: string): string[] {
    return [
      ...this.buckets.map((le, i) => `${name}_bucket{le="${le}"} ${this.counts[i]}`),
      `${name}_bucket{le="+Inf"} ${this.count}`,
      `${name}_sum ${this.sum}`,
      `${name}_count ${this.count}`,
    ];
  }
}

export interface MetricsSnapshot {
  health: HealthResult;
  telegramConnected: boolean;
  /** Останній звіт зі state.json; null — циклів ще не було або стан не прочитався. */
  lastReport: CycleReport | null;
}

function block(name: string, type: 'counter' | 'gauge' | 'histogram', help: string, lines: string[]): string[] {
  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, ...lines];
}

const bool = (value: boolean) => (value ? 1 : 0);

export class CollectorMetrics {
  private readonly cycles = new Map<CycleReport['status'], number>(CYCLE_STATUSES.map((s) => [s, 0]));
  private readonly chatFailures = new Map<FailureKind, number>(FAILURE_KINDS.map((k) => [k, 0]));
  private cycleErrors = 0;
  private messagesCollected = 0;
  private readonly chatRead = new Histogram(CHAT_READ_BUCKETS_SECONDS);
  private readonly cycleDuration = new Histogram(CYCLE_BUCKETS_SECONDS);

  private readonly processStartedAt: Date;

  constructor(processStartedAt: Date) {
    this.processStartedAt = processStartedAt;
  }

  observeChatRead(durationMs: number): void {
    this.chatRead.observe(durationMs / 1000);
  }

  recordCycle(report: CycleReport): void {
    this.cycles.set(report.status, (this.cycles.get(report.status) ?? 0) + 1);
    for (const failure of report.failures) {
      const kind = failureKind(failure.reason);
      this.chatFailures.set(kind, (this.chatFailures.get(kind) ?? 0) + 1);
    }
    this.messagesCollected += newMessagesOf(report);
    this.cycleDuration.observe((Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000);
  }

  /** Цикл не дійшов до звіту: мережа, авторизація, виняток до першого чату. */
  recordCycleError(): void {
    this.cycleErrors += 1;
  }

  render(snapshot: MetricsSnapshot): string {
    const last = snapshot.lastReport;
    const out = [
      ...block('tg_collector_health_ok', 'gauge', '1 when /health answers 200.', [`tg_collector_health_ok ${bool(snapshot.health.ok)}`]),
      ...block('tg_collector_telegram_connected', 'gauge', '1 when the MTProto client is connected.', [
        `tg_collector_telegram_connected ${bool(snapshot.telegramConnected)}`,
      ]),
      ...block('tg_collector_process_start_time_seconds', 'gauge', 'Process start; a change between scrapes means a restart.', [
        `tg_collector_process_start_time_seconds ${Math.floor(this.processStartedAt.getTime() / 1000)}`,
      ]),
      ...block('tg_collector_cycles_total', 'counter', 'Cycles that produced a report, by status, since process start.', [
        ...CYCLE_STATUSES.map((s) => `tg_collector_cycles_total{status="${s}"} ${this.cycles.get(s)}`),
      ]),
      ...block('tg_collector_cycle_errors_total', 'counter', 'Cycles aborted before a report, since process start.', [
        `tg_collector_cycle_errors_total ${this.cycleErrors}`,
      ]),
      ...block('tg_collector_chat_failures_total', 'counter', 'Chats that ended a cycle unread, by kind, since process start.', [
        ...FAILURE_KINDS.map((k) => `tg_collector_chat_failures_total{kind="${k}"} ${this.chatFailures.get(k)}`),
      ]),
      ...block('tg_collector_messages_collected_total', 'counter', 'New messages after dedup, since process start. Messages, not questions.', [
        `tg_collector_messages_collected_total ${this.messagesCollected}`,
      ]),
      ...block('tg_collector_chat_read_duration_seconds', 'histogram', 'One chat read, including failed ones.', this.chatRead.lines('tg_collector_chat_read_duration_seconds')),
      ...block('tg_collector_cycle_duration_seconds', 'histogram', 'One cycle from start to report.', this.cycleDuration.lines('tg_collector_cycle_duration_seconds')),
      ...block('tg_collector_last_cycle_timestamp_seconds', 'gauge', 'Finish of the latest cycle in state.json; 0 when there is none.', [
        `tg_collector_last_cycle_timestamp_seconds ${last ? Math.floor(Date.parse(last.finishedAt) / 1000) : 0}`,
      ]),
      ...block('tg_collector_last_cycle_status', 'gauge', 'Status of the latest cycle in state.json, one-hot.', [
        ...CYCLE_STATUSES.map((s) => `tg_collector_last_cycle_status{status="${s}"} ${bool(last?.status === s)}`),
      ]),
      ...block('tg_collector_last_cycle_chats_failed', 'gauge', 'Chats unread in the latest cycle.', [
        `tg_collector_last_cycle_chats_failed ${last ? last.failures.length : 0}`,
      ]),
      ...block('tg_collector_last_cycle_new_messages', 'gauge', 'New messages in the latest cycle. Messages, not questions: S-2 filter does not exist yet.', [
        `tg_collector_last_cycle_new_messages ${last ? newMessagesOf(last) : 0}`,
      ]),
    ];
    return `${out.join('\n')}\n`;
  }
}

export function newMessagesOf(report: CycleReport): number {
  return report.chats.reduce((sum, c) => sum + c.newMessages, 0);
}
