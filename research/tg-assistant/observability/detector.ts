/**
 * Тупий детектор колектора (урок 11.3): фіксовані пороги, жодного виклику моделі.
 *
 * Правило вирішує, агент пояснює. Цей файл лише порівнює числа з порогами і
 * складає короткий машинний звіт; `watch.ts` навколо нього ходить у Docker.
 *
 * Детектор свідомо не імпортує код колектора: нагляд, що залежить від того,
 * за чим наглядає, ламається разом із ним. Назви метрик тут — рядки контракту
 * з `metrics.ts`, і тест звіряє їх з реальним виводом.
 *
 * Логи — недовірений вхід: gramjs і стек-трейси пишуть що завгодно. У звіт
 * ідуть лише дозволені поля наших JSON-рядків, а сирі рядки обрізаються.
 */

export const REPORT_SCHEMA_VERSION = 1;

export const THRESHOLDS = {
  /** Будь-який рядок помилки — аномалія. Навмисно чутливо: у здорового колектора їх нуль. */
  maxErrorLines: 0,
  /** W38: 1 чат із 3 пішов у dead-letter через FLOOD_WAIT, і це очікувана поведінка ADR-0002. Два — вже ні. */
  maxChatsFailed: 1,
  /** Нуль нових повідомлень з усіх прочитаних чатів за тиждень — тиша, схожа на збій. W38 дав 53. */
  minNewMessages: 1,
  /** Розклад тижневий, плюс 2 години стелі циклу (health.ts `CYCLE_GRACE_MS`) і доба запасу. */
  maxCycleAgeHours: 7 * 24 + 2 + 24,
} as const;

export const MAX_REPORT_ERROR_LINES = 40;
const MAX_RAW_LINE_CHARS = 200;

/** Наші події, що означають помилку (main.ts `log`). */
const ERROR_EVENTS = new Set(['fatal', 'cycle_error', 'session_not_authorized']);
/** Єдині поля JSON-рядка, що доїжджають у звіт: службові коди, не текст. */
const SAFE_FIELDS = ['ts', 'event', 'error'] as const;

export type Mode = 'release' | 'cycle';

export type AnomalyCode =
  | 'container_not_running'
  | 'metrics_unreachable'
  | 'health_not_ok'
  | 'telegram_disconnected'
  | 'restarted'
  | 'error_log_lines'
  | 'cycle_failed_in_window'
  | 'no_cycle'
  | 'cycle_stale'
  | 'last_cycle_failed'
  | 'too_many_chats_failed'
  | 'no_new_messages';

export interface Anomaly {
  code: AnomalyCode;
  detail: string;
}

export interface Sample {
  at: string;
  containerStatus: string | null;
  restartCount: number | null;
  metrics: Record<string, number> | null;
  metricsError: string | null;
  /** Рядки помилок від початку вікна, уже очищені `errorLines`. */
  errors: string[];
}

/** Текстовий формат Prometheus → `серія{мітки}` → число. Коментарі й сміття пропускаються. */
export function parseMetrics(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const space = line.lastIndexOf(' ');
    if (space <= 0) continue;
    const value = Number(line.slice(space + 1));
    if (Number.isFinite(value)) out[line.slice(0, space)] = value;
  }
  return out;
}

const ANSI = /\x1b\[[0-9;]*m/g;
const GRAMJS_LEVEL = /\[(INFO|WARN|DEBUG)\]/;

/** Рядки `docker logs` → лише помилки, у безпечній для звіту формі. */
export function errorLines(logText: string): string[] {
  const out: string[] = [];
  for (const raw of logText.split('\n')) {
    const line = raw.replace(ANSI, '').trim();
    if (line === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = undefined;
    }
    if (parsed && typeof parsed === 'object' && 'event' in parsed) {
      const record = parsed as Record<string, unknown>;
      if (!ERROR_EVENTS.has(String(record.event))) continue;
      const safe = Object.fromEntries(SAFE_FIELDS.filter((f) => f in record).map((f) => [f, String(record[f]).slice(0, MAX_RAW_LINE_CHARS)]));
      out.push(JSON.stringify(safe));
      continue;
    }
    // Не наш JSON: INFO/WARN від gramjs і попередження Node — шум; решта (ERROR, стек) — помилка.
    if (GRAMJS_LEVEL.test(line) || line.startsWith('(node:')) continue;
    out.push(line.slice(0, MAX_RAW_LINE_CHARS));
  }
  return out;
}

const metric = (sample: Sample, series: string): number | null => sample.metrics?.[series] ?? null;

/** Скільки циклів певного статусу додалось від базового зразка. */
function grew(sample: Sample, baseline: Sample, series: string): number {
  return (metric(sample, series) ?? 0) - (metric(baseline, series) ?? 0);
}

function lastCycleStatus(sample: Sample): string | null {
  for (const status of ['completed', 'partial', 'failed']) {
    if (metric(sample, `tg_collector_last_cycle_status{status="${status}"}`) === 1) return status;
  }
  return null;
}

/**
 * Один зразок проти порогів. `baseline` — перший зразок вікна: рестарт і
 * провалений цикл судяться як зміна від нього, а не як абсолютне число, бо
 * лічильники живуть від старту процесу.
 */
export function assess(mode: Mode, sample: Sample, baseline: Sample, now: Date): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const add = (code: AnomalyCode, detail: string) => anomalies.push({ code, detail });

  if (sample.containerStatus !== 'running') add('container_not_running', `container status: ${sample.containerStatus ?? 'unknown'}`);
  if ((sample.restartCount ?? 0) > (baseline.restartCount ?? 0)) {
    add('restarted', `restart count ${baseline.restartCount} -> ${sample.restartCount}`);
  }
  if (sample.errors.length > THRESHOLDS.maxErrorLines) add('error_log_lines', `${sample.errors.length} error line(s) since window start`);

  if (sample.metrics === null) {
    add('metrics_unreachable', sample.metricsError ?? 'no response');
    return anomalies;
  }
  if (metric(sample, 'tg_collector_health_ok') !== 1) add('health_not_ok', 'tg_collector_health_ok is not 1');
  if (metric(sample, 'tg_collector_telegram_connected') !== 1) add('telegram_disconnected', 'tg_collector_telegram_connected is not 1');

  const startedBefore = metric(baseline, 'tg_collector_process_start_time_seconds');
  const startedNow = metric(sample, 'tg_collector_process_start_time_seconds');
  if (startedBefore !== null && startedNow !== null && startedNow !== startedBefore && !anomalies.some((a) => a.code === 'restarted')) {
    add('restarted', `process start time ${startedBefore} -> ${startedNow}`);
  }

  if (mode === 'release') {
    const failed = grew(sample, baseline, 'tg_collector_cycles_total{status="failed"}');
    const aborted = grew(sample, baseline, 'tg_collector_cycle_errors_total');
    if (failed > 0 || aborted > 0) add('cycle_failed_in_window', `failed cycles +${failed}, aborted cycles +${aborted}`);
    return anomalies;
  }

  // mode === 'cycle': числа останнього циклу проти порогів воріт G1.
  const finishedAt = metric(sample, 'tg_collector_last_cycle_timestamp_seconds') ?? 0;
  if (finishedAt === 0) {
    add('no_cycle', 'state.json has no cycle report');
    return anomalies;
  }
  const ageHours = (now.getTime() / 1000 - finishedAt) / 3600;
  if (ageHours > THRESHOLDS.maxCycleAgeHours) add('cycle_stale', `last cycle finished ${Math.round(ageHours)}h ago`);
  if (lastCycleStatus(sample) === 'failed') add('last_cycle_failed', 'last cycle status is failed');
  const chatsFailed = metric(sample, 'tg_collector_last_cycle_chats_failed') ?? 0;
  if (chatsFailed > THRESHOLDS.maxChatsFailed) add('too_many_chats_failed', `${chatsFailed} chats unread, limit ${THRESHOLDS.maxChatsFailed}`);
  const newMessages = metric(sample, 'tg_collector_last_cycle_new_messages') ?? 0;
  if (lastCycleStatus(sample) !== 'failed' && newMessages < THRESHOLDS.minNewMessages) {
    add('no_new_messages', `${newMessages} new messages, minimum ${THRESHOLDS.minNewMessages}`);
  }
  return anomalies;
}

export interface Report {
  schema_version: typeof REPORT_SCHEMA_VERSION;
  mode: Mode;
  verdict: 'healthy' | 'anomaly';
  release_sha: string | null;
  window_started_at: string;
  finished_at: string;
  window_minutes: number;
  samples_taken: number;
  anomalies: Anomaly[];
  /** Три числа уроку. Третє — повідомлення, не питання: фільтра S-2 ще немає. */
  three_numbers: {
    last_cycle_status: string | null;
    last_cycle_chats_failed: number | null;
    last_cycle_new_messages: number | null;
  };
  last_sample: {
    at: string;
    container_status: string | null;
    restart_count: number | null;
    health_ok: number | null;
    telegram_connected: number | null;
    last_cycle_finished_at: string | null;
    chat_read_p95_bucket_seconds: string | null;
  };
  error_lines: string[];
}

/** Верхня межа кошика, у який потрапляє 95-й перцентиль читань; `null` без читань. */
export function p95Bucket(metrics: Record<string, number> | null): string | null {
  if (!metrics) return null;
  const prefix = 'tg_collector_chat_read_duration_seconds_bucket{le="';
  const buckets = Object.entries(metrics)
    .filter(([series]) => series.startsWith(prefix))
    .map(([series, count]) => ({ le: series.slice(prefix.length, -2), count }));
  const total = buckets.find((b) => b.le === '+Inf')?.count ?? 0;
  if (total === 0) return null;
  return buckets.find((b) => b.count >= total * 0.95)?.le ?? '+Inf';
}

export function buildReport(input: {
  mode: Mode;
  releaseSha: string | null;
  windowStartedAt: string;
  windowMinutes: number;
  samples: Sample[];
  anomalies: Anomaly[];
  now: Date;
}): Report {
  const last = input.samples[input.samples.length - 1];
  const finished = last ? metric(last, 'tg_collector_last_cycle_timestamp_seconds') : null;
  return {
    schema_version: REPORT_SCHEMA_VERSION,
    mode: input.mode,
    verdict: input.anomalies.length === 0 ? 'healthy' : 'anomaly',
    release_sha: input.releaseSha,
    window_started_at: input.windowStartedAt,
    finished_at: input.now.toISOString(),
    window_minutes: input.windowMinutes,
    samples_taken: input.samples.length,
    anomalies: input.anomalies,
    three_numbers: {
      last_cycle_status: last ? lastCycleStatus(last) : null,
      last_cycle_chats_failed: last ? metric(last, 'tg_collector_last_cycle_chats_failed') : null,
      last_cycle_new_messages: last ? metric(last, 'tg_collector_last_cycle_new_messages') : null,
    },
    last_sample: {
      at: last?.at ?? input.now.toISOString(),
      container_status: last?.containerStatus ?? null,
      restart_count: last?.restartCount ?? null,
      health_ok: last ? metric(last, 'tg_collector_health_ok') : null,
      telegram_connected: last ? metric(last, 'tg_collector_telegram_connected') : null,
      last_cycle_finished_at: finished ? new Date(finished * 1000).toISOString() : null,
      chat_read_p95_bucket_seconds: last ? p95Bucket(last.metrics) : null,
    },
    error_lines: (last?.errors ?? []).slice(-MAX_REPORT_ERROR_LINES),
  };
}
