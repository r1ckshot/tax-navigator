import { describe, expect, it } from 'vitest';
import type { HealthResult } from '../health';
import { CollectorMetrics } from '../metrics';
import type { CycleReport } from '../state';
import { assess, buildReport, errorLines, MAX_REPORT_ERROR_LINES, p95Bucket, parseMetrics, type Sample } from './detector';

const START = new Date('2026-09-14T05:59:30Z');
const NOW = new Date('2026-09-14T09:00:00Z');
const healthy: HealthResult = { ok: true, problems: [], weekOf: '2026-W38', lastCycle: null };

function report(overrides: Partial<CycleReport> = {}): CycleReport {
  return {
    weekOf: '2026-W38',
    status: 'partial',
    startedAt: '2026-09-14T06:00:00.000Z',
    finishedAt: '2026-09-14T06:04:10.000Z',
    chats: [
      { ref: 'a', title: 'A', newMessages: 41, windowStartAt: null },
      { ref: 'b', title: 'B', newMessages: 12, windowStartAt: null },
    ],
    failures: [{ ref: 'c', title: 'C', reason: 'Chat exhausted after 3 consecutive FLOOD_WAIT retries (last FLOOD_WAIT_X=31s)' }],
    ...overrides,
  };
}

/** Зразок із справжнього виводу `/metrics`: назви серій звіряються з metrics.ts, а не переписуються. */
function sample(opts: {
  metrics?: CollectorMetrics;
  health?: HealthResult;
  telegramConnected?: boolean;
  lastReport?: CycleReport | null;
  restartCount?: number;
  containerStatus?: string;
  errors?: string[];
  unreachable?: string;
}): Sample {
  const metrics = opts.metrics ?? new CollectorMetrics(START);
  return {
    at: NOW.toISOString(),
    containerStatus: opts.containerStatus ?? 'running',
    restartCount: opts.restartCount ?? 0,
    metrics: opts.unreachable
      ? null
      : parseMetrics(
          metrics.render({
            health: opts.health ?? healthy,
            telegramConnected: opts.telegramConnected ?? true,
            lastReport: opts.lastReport === undefined ? report() : opts.lastReport,
          }),
        ),
    metricsError: opts.unreachable ?? null,
    errors: opts.errors ?? [],
  };
}

const codes = (anomalies: { code: string }[]) => anomalies.map((a) => a.code);

describe('parseMetrics', () => {
  it('читає серії з мітками й пропускає коментарі', () => {
    const parsed = parseMetrics('# HELP x y\n# TYPE x gauge\nx 1\ny{status="failed"} 0\nbroken\nz{le="+Inf"} 3\n');
    expect(parsed).toEqual({ x: 1, 'y{status="failed"}': 0, 'z{le="+Inf"}': 3 });
  });
});

describe('errorLines', () => {
  it('шум gramjs і звичайні події пропускає, помилки лишає', () => {
    const log = [
      '\x1b[34m[2026-09-14T17:10:31.120] [INFO] - [Running gramJS version 2.26.22]\x1b[0m',
      '{"ts":"2026-09-14T17:10:33Z","event":"worker_started","chats":3}',
      '{"ts":"2026-09-14T06:04:10Z","event":"cycle_finished","status":"partial"}',
      '\x1b[31m[2026-09-14T17:11:00.000] [ERROR] - [Error: Connection closed]\x1b[0m',
      '    at TCPWrap.onStreamRead (node:internal/stream_base_commons:216:20)',
      '(node:1) Warning: something deprecated',
      '',
    ].join('\n');
    expect(errorLines(log)).toEqual([
      '[2026-09-14T17:11:00.000] [ERROR] - [Error: Connection closed]',
      'at TCPWrap.onStreamRead (node:internal/stream_base_commons:216:20)',
    ]);
  });

  it('з нашого JSON у звіт іде лише ts, event, error — підказки й решта полів відкидаються', () => {
    const log = [
      '{"ts":"t1","event":"session_not_authorized","hint":"run node login.ts and put the result into TG_SESSION"}',
      '{"ts":"t2","event":"cycle_error","error":"TimeoutError","retryAfter":"x","text":"private message"}',
      '{"ts":"t3","event":"fatal","error":"missing environment variables: TG_SESSION"}',
    ].join('\n');
    expect(errorLines(log)).toEqual([
      '{"ts":"t1","event":"session_not_authorized"}',
      '{"ts":"t2","event":"cycle_error","error":"TimeoutError"}',
      '{"ts":"t3","event":"fatal","error":"missing environment variables: TG_SESSION"}',
    ]);
  });

  it('сирий рядок обрізається до 200 символів', () => {
    expect(errorLines('x'.repeat(500))[0]).toHaveLength(200);
  });
});

describe('assess — вікно після релізу', () => {
  it('здоровий колектор без циклу у вікні: жодної аномалії', () => {
    const base = sample({});
    expect(assess('release', sample({}), base, NOW)).toEqual([]);
  });

  it('старий провалений цикл ДО релізу не рахується: реліз його не спричинив', () => {
    const base = sample({ lastReport: report({ status: 'failed', chats: [] }), health: { ...healthy, ok: true } });
    expect(codes(assess('release', base, base, NOW))).toEqual([]);
  });

  it('рестарт видно і за лічильником Docker, і за часом старту процесу', () => {
    const base = sample({});
    expect(codes(assess('release', sample({ restartCount: 1 }), base, NOW))).toEqual(['restarted']);
    const restartedProcess = sample({ metrics: new CollectorMetrics(new Date('2026-09-14T08:30:00Z')) });
    expect(codes(assess('release', restartedProcess, base, NOW))).toEqual(['restarted']);
  });

  it('недоступний /metrics і зупинений контейнер', () => {
    const base = sample({});
    expect(codes(assess('release', sample({ unreachable: 'exec exit 1', containerStatus: 'exited' }), base, NOW))).toEqual([
      'container_not_running',
      'metrics_unreachable',
    ]);
  });

  it('здоров’я і Telegram', () => {
    const base = sample({});
    const sick = sample({ health: { ...healthy, ok: false }, telegramConnected: false });
    expect(codes(assess('release', sick, base, NOW))).toEqual(['health_not_ok', 'telegram_disconnected']);
  });

  it('один рядок помилки вже аномалія (поріг 0)', () => {
    const base = sample({});
    expect(codes(assess('release', sample({ errors: ['{"event":"cycle_error"}'] }), base, NOW))).toEqual(['error_log_lines']);
  });

  it('цикл, що провалився або обірвався у вікні, — аномалія', () => {
    const running = new CollectorMetrics(START);
    const base = sample({ metrics: running });
    running.recordCycle(report({ status: 'failed', chats: [] }));
    running.recordCycleError();
    const after = assess('release', sample({ metrics: running }), base, NOW);
    expect(after).toEqual([{ code: 'cycle_failed_in_window', detail: 'failed cycles +1, aborted cycles +1' }]);
  });
});

describe('assess — числа циклу проти порогів', () => {
  it('W38 (partial, 1 чат не прочитано, 53 повідомлення) у межах порогів', () => {
    const s = sample({});
    expect(assess('cycle', s, s, NOW)).toEqual([]);
  });

  it('два непрочитані чати — вже аномалія', () => {
    const failures = report().failures;
    const s = sample({ lastReport: report({ failures: [...failures, { ref: 'd', title: 'D', reason: 'access_lost (CHANNEL_PRIVATE)' }] }) });
    expect(codes(assess('cycle', s, s, NOW))).toEqual(['too_many_chats_failed']);
  });

  it('нуль нових повідомлень при прочитаних чатах — тиша, схожа на збій', () => {
    const s = sample({ lastReport: report({ chats: [{ ref: 'a', title: 'A', newMessages: 0, windowStartAt: null }] }) });
    expect(codes(assess('cycle', s, s, NOW))).toEqual(['no_new_messages']);
  });

  it('проваленому циклу не дописується ще й «нуль повідомлень»', () => {
    const s = sample({ lastReport: report({ status: 'failed', chats: [] }) });
    expect(codes(assess('cycle', s, s, NOW))).toEqual(['last_cycle_failed']);
  });

  it('циклу немає взагалі, або він старший за тиждень + 26 год', () => {
    const none = sample({ lastReport: null });
    expect(codes(assess('cycle', none, none, NOW))).toEqual(['no_cycle']);
    const s = sample({});
    // Цикл закінчився 2026-09-14T06:04:10Z; 194 год (7×24 + 2 + 24) минають 2026-09-22T08:04:10Z.
    expect(codes(assess('cycle', s, s, new Date('2026-09-22T08:04:00Z')))).toEqual([]);
    expect(codes(assess('cycle', s, s, new Date('2026-09-22T08:05:00Z')))).toEqual(['cycle_stale']);
  });
});

describe('p95Bucket і звіт', () => {
  it('p95 з кумулятивних кошиків: 3 читання (0.3, 4, 45 с) → 2.85 з 3 уперше досягається в кошику 60', () => {
    const m = new CollectorMetrics(START);
    for (const ms of [300, 4000, 45_000]) m.observeChatRead(ms);
    expect(p95Bucket(sample({ metrics: m }).metrics)).toBe('60');
    expect(p95Bucket(sample({}).metrics)).toBeNull();
  });

  it('звіт має фіксовану форму, три числа і не більше 40 рядків помилок', () => {
    const errors = Array.from({ length: 55 }, (_, i) => `line ${i}`);
    const s = sample({ errors });
    const r = buildReport({
      mode: 'release',
      releaseSha: 'abc123',
      windowStartedAt: '2026-09-14T08:40:00Z',
      windowMinutes: 20,
      samples: [s],
      anomalies: assess('release', s, s, NOW),
      now: NOW,
    });
    expect(r.schema_version).toBe(1);
    expect(r.verdict).toBe('anomaly');
    expect(r.three_numbers).toEqual({ last_cycle_status: 'partial', last_cycle_chats_failed: 1, last_cycle_new_messages: 53 });
    expect(r.last_sample.last_cycle_finished_at).toBe('2026-09-14T06:04:10.000Z');
    expect(r.error_lines).toHaveLength(MAX_REPORT_ERROR_LINES);
    expect(r.error_lines[0]).toBe('line 15');
  });
});
