/**
 * Точка входу воркера (sad.md §5 `cycle.ts`).
 *
 *   node main.ts run    — довгоживучий процес: розклад, цикл, /health, /metrics
 *   node main.ts chats  — список груп і каналів акаунта, щоб заповнити TG_CHATS
 *   node main.ts report [2026-W39] — тижневий звіт зі стану (S-4); без тижня — останній цикл
 *   node main.ts sample [2026-W39] [--seed N] [--chat REF [--from DATE --to DATE]] [--near-miss N] [--other N]
 *                          — вибірка для розмітки фільтра (sample.ts), JSON у stdout
 *
 * Лог — JSON-рядки у stdout. У лог не йде ні текст повідомлень, ні значення
 * змінних середовища: лише події, лічильники і службові коди.
 */

import { createServer } from 'node:http';
import { runCycle } from './collector.ts';
import { ConfigError, parseConfig, type WorkerConfig } from './config.ts';
import { evaluateHealth } from './health.ts';
import { loadMatrix } from './labeler.ts';
import { CollectorMetrics } from './metrics.ts';
import { buildWeeklyReport, renderWeeklyReport } from './reporter.ts';
import { DEFAULT_LIMITS, drawSample, planChatWindow, planFailedChat, planSample, SampleError, type SampleMessage } from './sample.ts';
import { isCycleDue, isoWeek } from './schedule.ts';
import { hasCycleRun, latestReport, loadState, messageKey, saveState, type CycleState } from './state.ts';
import { createClient, GramjsPort } from './telegram.ts';

const TICK_MS = 60 * 1000;
/** `sample` читає без черги, тож коротку паузу Telegram просто перечікує. */
const SAMPLE_FLOOD_SLEEP_SECONDS = 120;
/** Після збою до першого чату (мережа, авторизація) — не долбити Telegram щохвилини. */
const RETRY_AFTER_ERROR_MS = 15 * 60 * 1000;

function log(event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), event, ...fields })}\n`);
}

function readState(path: string): { state: CycleState | null; error: string | null } {
  try {
    return { state: loadState(path), error: null };
  } catch (err) {
    return { state: null, error: (err as NodeJS.ErrnoException).code ?? (err as Error).name };
  }
}

/** Матриця публічна, тож причину збою можна показати цілком, разом зі шляхом. */
function readMatrix(path: string) {
  try {
    return loadMatrix(path);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new ConfigError(`RULES_PATH ${path}: ${code ?? (err as Error).message}`);
  }
}

async function connect(apiId: number, apiHash: string, session: string, floodSleepThreshold?: number) {
  const client = createClient(apiId, apiHash, session, floodSleepThreshold);
  await client.connect();
  if (!(await client.checkAuthorization())) {
    log('session_not_authorized', { hint: 'run "node login.ts" and put the result into TG_SESSION' });
    await client.destroy();
    process.exit(1);
  }
  return client;
}

async function run(config: WorkerConfig): Promise<void> {
  const processStartedAt = new Date();
  const metrics = new CollectorMetrics(processStartedAt);

  // Том перевіряється на запис до першого циклу: ненаписаний стан виявився б
  // лише через тиждень, а так контейнер падає одразу.
  saveState(config.statePath, loadState(config.statePath));
  // Матриця теж до першого циклу: без неї тиждень питань став би білими плямами.
  const matrix = readMatrix(config.rulesPath);

  const client = await connect(config.apiId, config.apiHash, config.session, config.floodSleepSeconds);
  const port = new GramjsPort(client);
  log('worker_started', { chats: config.chats.length, schedule: config.schedule, windowWeeks: config.windowWeeks, floodSleepSeconds: config.floodSleepSeconds, rules: matrix.rules.length, rulesVerifiedAt: matrix.verified_at });

  const server = createServer((req, res) => {
    if (req.url !== '/health' && req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    const { state, error } = readState(config.statePath);
    const telegramConnected = client.connected === true;
    const health = evaluateHealth({
      now: new Date(),
      processStartedAt,
      schedule: config.schedule,
      state,
      stateError: error,
      telegramConnected,
    });
    if (req.url === '/metrics') {
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
      res.end(metrics.render({ health, telegramConnected, lastReport: state ? latestReport(state) : null }));
      return;
    }
    res.writeHead(health.ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...health, stateError: error }));
  });
  // Лише loopback: healthcheck і детектор ходять зсередини контейнера, назовні порт не потрібен.
  server.listen(config.healthPort, '127.0.0.1');

  let running = false;
  let retryAfter = 0;

  const tick = async () => {
    const now = new Date();
    if (running || now.getTime() < retryAfter) return;
    const current = loadState(config.statePath);
    if (!isCycleDue(now, config.schedule, hasCycleRun(current, isoWeek(now)))) return;

    running = true;
    log('cycle_started', { weekOf: isoWeek(now) });
    const readDurations: number[] = [];
    try {
      const result = await runCycle({
        port,
        state: current,
        targets: config.chats,
        now: () => new Date(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        windowWeeks: config.windowWeeks,
        maxFloodWaitSeconds: config.maxFloodWaitSeconds,
        matrix,
        onChatRead: (ms) => {
          readDurations.push(ms);
          metrics.observeChatRead(ms);
        },
      });
      if (result.skipped) return;
      saveState(config.statePath, result.state);
      metrics.recordCycle(result.report);
      log('cycle_finished', {
        weekOf: result.weekOf,
        status: result.report.status,
        chatsRead: result.report.chats.length,
        newMessages: result.messages.length,
        organicQuestions: result.organic.length,
        covered: result.report.labels?.covered ?? 0,
        whiteSpots: result.report.labels?.whiteSpot ?? 0,
        failures: result.report.failures.map((f) => ({ ref: f.ref, reason: f.reason })),
        windowed: result.report.chats.filter((c) => c.windowStartAt !== null).map((c) => c.ref),
        durationMs: Date.parse(result.report.finishedAt) - Date.parse(result.report.startedAt),
        slowestChatReadMs: readDurations.length > 0 ? Math.max(...readDurations) : null,
      });
    } catch (err) {
      retryAfter = Date.now() + RETRY_AFTER_ERROR_MS;
      metrics.recordCycleError();
      log('cycle_error', { error: err instanceof Error ? err.name : 'unknown', retryAfter: new Date(retryAfter).toISOString() });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), TICK_MS);
  void tick();

  const shutdown = async (signal: string) => {
    log('worker_stopping', { signal, cycleInterrupted: running });
    clearInterval(timer);
    server.close();
    await client.destroy();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

async function listChats(): Promise<void> {
  const { TG_API_ID, TG_API_HASH, TG_SESSION } = process.env;
  if (!TG_API_ID || !TG_API_HASH || !TG_SESSION) {
    throw new ConfigError('missing environment variables: TG_API_ID, TG_API_HASH, TG_SESSION');
  }
  const client = await connect(Number(TG_API_ID), TG_API_HASH, TG_SESSION);
  for (const chat of await new GramjsPort(client).listJoinedChats()) {
    process.stdout.write(`${chat.id}\t${chat.username ?? '-'}\t${chat.title}\n`);
  }
  await client.destroy();
}

/**
 * Звіт читає лише файл стану: ні секретів Telegram, ні з'єднання не потрібно,
 * тож його можна зібрати поруч із працюючим воркером (`docker compose exec`).
 * Незавершений або відсутній тиждень — exit 1, щоб скрипт не прийняв його за звіт.
 */
function printReport(weekOf: string | undefined): void {
  if (weekOf !== undefined && !/^\d{4}-W\d{2}$/.test(weekOf)) throw new ConfigError(`week must look like 2026-W39, got "${weekOf}"`);
  const report = buildWeeklyReport(loadState(process.env.STATE_PATH || '/data/state.json'), weekOf);
  process.stdout.write(renderWeeklyReport(report));
  if (report.state !== 'finished') process.exit(1);
}

/**
 * Єдина команда, що виводить текст повідомлень, і виводить його лише в stdout:
 * на диск сервера він не лягає, файл збирає людина у себе.
 * Стан тільки читається. Друге з'єднання з тією самою сесією поруч із живим
 * воркером ризикує AUTH_KEY_DUPLICATED, тому запускати, коли воркер зупинено.
 */
async function printSample(args: string[]): Promise<void> {
  const valueOf = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const intFlag = (flag: string, fallback: number) => {
    const raw = valueOf(flag);
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new ConfigError(`${flag} must be a non-negative integer, got "${raw}"`);
    return value;
  };
  const seed = intFlag('--seed', 1);
  const limits = { nearMiss: intFlag('--near-miss', DEFAULT_LIMITS.nearMiss), other: intFlag('--other', DEFAULT_LIMITS.other) };
  const chatRef = valueOf('--chat');
  const weekOf = args.find((a, i) => /^\d{4}-W\d{2}$/.test(a) && !args[i - 1]?.startsWith('--'));

  const state = loadState(process.env.STATE_PATH || '/data/state.json');
  const from = valueOf('--from');
  const to = valueOf('--to');
  if ((from || to) && !(chatRef && from && to)) throw new ConfigError('--from and --to go together and need --chat');
  const plan = chatRef && from && to ? planChatWindow(state, chatRef, from, to) : chatRef ? planFailedChat(state, chatRef, weekOf) : planSample(state, weekOf);
  const { TG_API_ID, TG_API_HASH, TG_SESSION } = process.env;
  if (!TG_API_ID || !TG_API_HASH || !TG_SESSION) {
    throw new ConfigError('missing environment variables: TG_API_ID, TG_API_HASH, TG_SESSION');
  }
  const client = await connect(Number(TG_API_ID), TG_API_HASH, TG_SESSION, SAMPLE_FLOOD_SLEEP_SECONDS);
  const port = new GramjsPort(client);
  const joined = await port.listJoinedChats();

  const messages: SampleMessage[] = [];
  try {
    for (const planned of plan.chats) {
      const found = joined.find((c) => c.id === planned.ref || c.username?.toLowerCase() === planned.ref);
      const chatId = planned.chatId ?? found?.id;
      if (!chatId) throw new SampleError(`chat ${planned.ref} is not among the account's dialogs`);
      const chat = { ...planned, chatId, title: found?.title ?? planned.title };
      const read = (await port.readMessagesSince(chatId, chat.since)).filter(
        (m) => m.postedAt < plan.until && (!chat.onlySeen || messageKey(chatId, m.telegramMessageId) in state.seenMessages)
      );
      // Розбіжність — не причина зупинятись (повідомлення могли видалити), але
      // її видно в stderr: stdout — це файл вибірки.
      process.stderr.write(`${JSON.stringify({ event: 'sample_chat', ref: chat.ref, expected: chat.expected, read: read.length })}\n`);
      for (const m of read) messages.push({ ...m, chatId, chatTitle: chat.title });
    }
  } finally {
    await client.destroy();
  }
  process.stdout.write(`${JSON.stringify(drawSample(plan.weekOf, messages, seed, limits), null, 2)}\n`);
}

const command = process.argv[2];
try {
  if (command === 'run') await run(parseConfig(process.env));
  else if (command === 'chats') await listChats();
  else if (command === 'report') printReport(process.argv[3]);
  else if (command === 'sample') await printSample(process.argv.slice(3));
  else {
    process.stderr.write('usage: node main.ts run | chats | report [week] | sample [week] [--seed N] [--chat REF [--from DATE --to DATE]] [--near-miss N] [--other N]\n');
    process.exit(2);
  }
} catch (err) {
  log('fatal', { error: err instanceof ConfigError || err instanceof SampleError ? err.message : err instanceof Error ? err.name : 'unknown' });
  process.exit(1);
}
