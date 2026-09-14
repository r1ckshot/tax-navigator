import { describe, expect, it } from 'vitest';
import type { HealthResult } from './health';
import { CollectorMetrics, failureKind } from './metrics';
import type { CycleReport } from './state';

const START = new Date('2026-09-14T05:59:30Z');

const healthy: HealthResult = { ok: true, problems: [], weekOf: '2026-W38', lastCycle: null };

/** Той самий розклад, що перший живий цикл W38: 3 чати, один у dead-letter. */
function w38(): CycleReport {
  return {
    weekOf: '2026-W38',
    status: 'partial',
    startedAt: '2026-09-14T06:00:00.000Z',
    finishedAt: '2026-09-14T06:04:10.000Z',
    chats: [
      { ref: 'polska_ua_chat', title: 'Поляки UA', newMessages: 41, windowStartAt: '2026-08-17T06:00:00.000Z' },
      { ref: '-1001234567890', title: 'Податки PL', newMessages: 12, windowStartAt: null },
    ],
    failures: [
      {
        ref: 'itpoland',
        title: 'IT Poland',
        reason: 'Chat exhausted after 3 consecutive FLOOD_WAIT retries (last FLOOD_WAIT_X=31s); moving to dead letter queue',
      },
    ],
  };
}

/** Значення рядка метрики за точним ім'ям з мітками. */
function value(text: string, series: string): number {
  const line = text.split('\n').find((l) => l.startsWith(`${series} `));
  if (line === undefined) throw new Error(`no series ${series}`);
  return Number(line.slice(series.length + 1));
}

describe('failureKind', () => {
  it('зводить вільний рядок причини до трьох видів', () => {
    expect(failureKind('access_lost (no longer in dialogs)')).toBe('access_lost');
    expect(failureKind('access_lost (CHANNEL_PRIVATE)')).toBe('access_lost');
    expect(failureKind('read_failed (TimeoutError)')).toBe('read_failed');
    expect(failureKind('Chat exhausted after 3 consecutive FLOOD_WAIT retries (last FLOOD_WAIT_X=31s); moving to dead letter queue')).toBe('flood_wait');
    expect(failureKind('FLOOD_WAIT_X=900s exceeds the per-cycle limit of 600s; moving to dead letter queue')).toBe('flood_wait');
  });
});

describe('CollectorMetrics', () => {
  it('до першого циклу: лічильники нульові, останнього циклу немає', () => {
    const text = new CollectorMetrics(START).render({ health: healthy, telegramConnected: true, lastReport: null });
    expect(value(text, 'tg_collector_health_ok')).toBe(1);
    expect(value(text, 'tg_collector_cycles_total{status="completed"}')).toBe(0);
    expect(value(text, 'tg_collector_last_cycle_timestamp_seconds')).toBe(0);
    expect(value(text, 'tg_collector_last_cycle_status{status="failed"}')).toBe(0);
    // 2026-09-14T05:59:30Z = 1789365570 с (date -d … +%s).
    expect(value(text, 'tg_collector_process_start_time_seconds')).toBe(1789365570);
  });

  it('цикл W38 дає три числа: partial, 1 чат не прочитано, 41 + 12 = 53 повідомлення', () => {
    const metrics = new CollectorMetrics(START);
    metrics.recordCycle(w38());
    const text = metrics.render({ health: healthy, telegramConnected: true, lastReport: w38() });

    expect(value(text, 'tg_collector_last_cycle_status{status="partial"}')).toBe(1);
    expect(value(text, 'tg_collector_last_cycle_status{status="completed"}')).toBe(0);
    expect(value(text, 'tg_collector_last_cycle_chats_failed')).toBe(1);
    expect(value(text, 'tg_collector_last_cycle_new_messages')).toBe(53);

    expect(value(text, 'tg_collector_cycles_total{status="partial"}')).toBe(1);
    expect(value(text, 'tg_collector_chat_failures_total{kind="flood_wait"}')).toBe(1);
    expect(value(text, 'tg_collector_chat_failures_total{kind="access_lost"}')).toBe(0);
    expect(value(text, 'tg_collector_messages_collected_total')).toBe(53);
    // 06:00:00 → 06:04:10 = 250 с: не влазить у кошик 60, влазить у 300.
    expect(value(text, 'tg_collector_cycle_duration_seconds_bucket{le="60"}')).toBe(0);
    expect(value(text, 'tg_collector_cycle_duration_seconds_bucket{le="300"}')).toBe(1);
    expect(value(text, 'tg_collector_cycle_duration_seconds_sum')).toBe(250);
    // 2026-09-14T06:04:10Z = 1789365850 с.
    expect(value(text, 'tg_collector_last_cycle_timestamp_seconds')).toBe(1789365850);
  });

  it('після рестарту лічильники нульові, а числа останнього циклу беруться зі стану', () => {
    const text = new CollectorMetrics(START).render({ health: healthy, telegramConnected: true, lastReport: w38() });
    expect(value(text, 'tg_collector_cycles_total{status="partial"}')).toBe(0);
    expect(value(text, 'tg_collector_last_cycle_new_messages')).toBe(53);
  });

  it('гістограма читань кумулятивна: 0.3 с, 4 с і 45 с', () => {
    const metrics = new CollectorMetrics(START);
    for (const ms of [300, 4000, 45_000]) metrics.observeChatRead(ms);
    const text = metrics.render({ health: healthy, telegramConnected: true, lastReport: null });
    expect(value(text, 'tg_collector_chat_read_duration_seconds_bucket{le="0.5"}')).toBe(1);
    expect(value(text, 'tg_collector_chat_read_duration_seconds_bucket{le="5"}')).toBe(2);
    expect(value(text, 'tg_collector_chat_read_duration_seconds_bucket{le="30"}')).toBe(2);
    expect(value(text, 'tg_collector_chat_read_duration_seconds_bucket{le="60"}')).toBe(3);
    expect(value(text, 'tg_collector_chat_read_duration_seconds_bucket{le="+Inf"}')).toBe(3);
    expect(value(text, 'tg_collector_chat_read_duration_seconds_count')).toBe(3);
    expect(value(text, 'tg_collector_chat_read_duration_seconds_sum')).toBe(49.3);
  });

  it('збій здоров’я і обрив Telegram видно як нулі, а не як відсутні рядки', () => {
    const sick: HealthResult = { ok: false, problems: ['telegram_disconnected'], weekOf: '2026-W38', lastCycle: null };
    const metrics = new CollectorMetrics(START);
    metrics.recordCycleError();
    const text = metrics.render({ health: sick, telegramConnected: false, lastReport: null });
    expect(value(text, 'tg_collector_health_ok')).toBe(0);
    expect(value(text, 'tg_collector_telegram_connected')).toBe(0);
    expect(value(text, 'tg_collector_cycle_errors_total')).toBe(1);
  });

  it('жодна назва чату, ref чи причина-рядок не потрапляє в /metrics', () => {
    const metrics = new CollectorMetrics(START);
    metrics.recordCycle(w38());
    const text = metrics.render({ health: healthy, telegramConnected: true, lastReport: w38() });
    for (const leak of ['polska_ua_chat', '-1001234567890', 'itpoland', 'IT Poland', 'Поляки', 'Податки', 'FLOOD_WAIT_X', 'exhausted']) {
      expect(text).not.toContain(leak);
    }
  });
});
