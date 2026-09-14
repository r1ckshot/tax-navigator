/**
 * Точка входу воркера (sad.md §5 `cycle.ts`).
 *
 *   node main.ts run    — довгоживучий процес: розклад, цикл, /health
 *   node main.ts chats  — список груп і каналів акаунта, щоб заповнити TG_CHATS
 *
 * Лог — JSON-рядки у stdout. У лог не йде ні текст повідомлень, ні значення
 * змінних середовища: лише події, лічильники і службові коди.
 */

import { createServer } from 'node:http';
import { runCycle } from './collector.ts';
import { ConfigError, parseConfig, type WorkerConfig } from './config.ts';
import { evaluateHealth } from './health.ts';
import { isCycleDue, isoWeek } from './schedule.ts';
import { hasCycleRun, loadState, saveState, type CycleState } from './state.ts';
import { createClient, GramjsPort } from './telegram.ts';

const TICK_MS = 60 * 1000;
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

async function connect(apiId: number, apiHash: string, session: string) {
  const client = createClient(apiId, apiHash, session);
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

  // Том перевіряється на запис до першого циклу: ненаписаний стан виявився б
  // лише через тиждень, а так контейнер падає одразу.
  saveState(config.statePath, loadState(config.statePath));

  const client = await connect(config.apiId, config.apiHash, config.session);
  const port = new GramjsPort(client);
  log('worker_started', { chats: config.chats.length, schedule: config.schedule, windowWeeks: config.windowWeeks });

  const server = createServer((req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const { state, error } = readState(config.statePath);
    const health = evaluateHealth({
      now: new Date(),
      processStartedAt,
      schedule: config.schedule,
      state,
      stateError: error,
      telegramConnected: client.connected === true,
    });
    res.writeHead(health.ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...health, stateError: error }));
  });
  // Лише loopback: healthcheck Docker ходить зсередини контейнера, назовні порт не потрібен.
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
    try {
      const result = await runCycle({
        port,
        state: current,
        targets: config.chats,
        now: () => new Date(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        windowWeeks: config.windowWeeks,
        maxFloodWaitSeconds: config.maxFloodWaitSeconds,
      });
      if (result.skipped) return;
      saveState(config.statePath, result.state);
      // S-2 (фільтр) ще не існує: зібраний текст рахується і відпускається з пам'яті.
      log('cycle_finished', {
        weekOf: result.weekOf,
        status: result.report.status,
        chatsRead: result.report.chats.length,
        newMessages: result.messages.length,
        failures: result.report.failures.map((f) => ({ ref: f.ref, reason: f.reason })),
        windowed: result.report.chats.filter((c) => c.windowStartAt !== null).map((c) => c.ref),
        durationMs: Date.parse(result.report.finishedAt) - Date.parse(result.report.startedAt),
      });
    } catch (err) {
      retryAfter = Date.now() + RETRY_AFTER_ERROR_MS;
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

const command = process.argv[2];
try {
  if (command === 'run') await run(parseConfig(process.env));
  else if (command === 'chats') await listChats();
  else {
    process.stderr.write('usage: node main.ts run | chats\n');
    process.exit(2);
  }
} catch (err) {
  log('fatal', { error: err instanceof ConfigError ? err.message : err instanceof Error ? err.name : 'unknown' });
  process.exit(1);
}
