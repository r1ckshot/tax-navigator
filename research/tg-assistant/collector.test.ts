import { describe, expect, it } from 'vitest';
import {
  runCycle,
  TelegramReadError,
  type JoinedChat,
  type RawMessage,
  type ReadFailure,
  type RunCycleInput,
  type TelegramPort,
} from './collector';
import { defaultState, type CycleState } from './state';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const WEEK = 7 * DAY;

// Понеділок 2026-W38, 06:00 UTC — момент циклу за дефолтним розкладом.
const W38 = Date.parse('2026-09-14T06:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function chat(id: string, username: string | null, createdAgoWeeks = 52): JoinedChat {
  return { id, username, title: `Title ${id}`, createdAt: iso(W38 - createdAgoWeeks * WEEK) };
}

function msg(id: number, postedAtMs: number): RawMessage {
  return { telegramMessageId: id, postedAt: iso(postedAtMs), text: `private text #${id}` };
}

/** Фейковий Telegram: віддає повідомлення не раніше `since`, помилки — за сценарієм. */
function fakePort(opts: {
  chats: JoinedChat[];
  messages?: Record<string, RawMessage[]>;
  failures?: Record<string, Array<ReadFailure | Error>>;
  clock: { t: number };
  /** Скільки триває одне читання: годинник іде вперед, як у живому циклі. */
  readTakesMs?: number;
}): TelegramPort & { reads: Array<{ chatId: string; since: string; at: number }> } {
  const reads: Array<{ chatId: string; since: string; at: number }> = [];
  return {
    reads,
    async listJoinedChats() {
      return opts.chats;
    },
    async readMessagesSince(chatId, since) {
      reads.push({ chatId, since, at: opts.clock.t });
      const scripted = opts.failures?.[chatId]?.shift();
      if (scripted instanceof Error) throw scripted;
      if (scripted) throw new TelegramReadError(scripted);
      // Повідомлення з майбутнього ще не існує на момент читання.
      const visible = (opts.messages?.[chatId] ?? []).filter((m) => m.postedAt >= since && m.postedAt <= iso(opts.clock.t));
      opts.clock.t += opts.readTakesMs ?? 0;
      return visible;
    },
  };
}

function harness(startMs: number) {
  const clock = { t: startMs };
  const sleeps: number[] = [];
  return {
    clock,
    sleeps,
    base: (port: TelegramPort, state: CycleState, targets: string[]): RunCycleInput => ({
      port,
      state,
      targets,
      now: () => new Date(clock.t),
      sleep: async (ms) => {
        sleeps.push(ms);
        clock.t += ms;
      },
      windowWeeks: 4,
      maxFloodWaitSeconds: 600,
    }),
  };
}

async function run(input: RunCycleInput) {
  const result = await runCycle(input);
  if (result.skipped) throw new Error('expected a run, got skipped');
  return result;
}

describe('runCycle — AC-01 безнаглядний збір', () => {
  it('збирає нові повідомлення з обраних чатів; текст лише в пам’яті, у стані його немає', async () => {
    const h = harness(W38);
    const port = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'alpha_chat'), chat('-1002', 'beta_chat')],
      messages: { '-1001': [msg(10, W38 - DAY), msg(11, W38 - 2 * DAY)], '-1002': [msg(7, W38 - 3 * DAY)] },
    });

    const result = await run(h.base(port, defaultState(), ['alpha_chat', 'beta_chat']));

    expect(result.weekOf).toBe('2026-W38');
    expect(result.report.status).toBe('completed');
    expect(result.report.chats.map((c) => [c.ref, c.newMessages])).toEqual([
      ['alpha_chat', 2],
      ['beta_chat', 1],
    ]);
    expect(result.messages.map((m) => m.text)).toEqual(['private text #10', 'private text #11', 'private text #7']);
    // PRD §6.1: сирий текст на диск не пишеться — стан серіалізується без нього.
    expect(JSON.stringify(result.state)).not.toContain('private text');
  });

  it('повторний запуск у тому самому тижні пропускається цілком (ключ week_of)', async () => {
    const h = harness(W38);
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], messages: { '-1001': [msg(1, W38 - DAY)] } });
    const first = await run(h.base(port, defaultState(), ['alpha_chat']));

    h.clock.t += 3 * DAY;
    const second = await runCycle(h.base(port, first.state, ['alpha_chat']));

    expect(second).toEqual({ skipped: true, weekOf: '2026-W38' });
    expect(port.reads).toHaveLength(1);
  });
});

describe('runCycle — AC-02 чужий чат', () => {
  it('ціль без членства не читається і не згадується у звіті; діалог поза цілями теж не читається', async () => {
    const h = harness(W38);
    const port = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'alpha_chat'), chat('-1009', 'unrelated_dialog')],
      messages: { '-1001': [msg(1, W38 - DAY)], '-1009': [msg(2, W38 - DAY)] },
    });

    const result = await run(h.base(port, defaultState(), ['alpha_chat', 'never_joined']));

    expect(port.reads.map((r) => r.chatId)).toEqual(['-1001']);
    expect(JSON.stringify(result.report)).not.toContain('never_joined');
    expect(result.report.failures).toEqual([]);
  });

  it('чат, названий і username-ом, і id, читається один раз', async () => {
    const h = harness(W38);
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], messages: { '-1001': [msg(1, W38 - DAY)] } });

    const result = await run(h.base(port, defaultState(), ['alpha_chat', '-1001']));

    expect(port.reads).toHaveLength(1);
    expect(result.report.chats).toHaveLength(1);
  });
});

describe('runCycle — AC-08 недоступні чати названо, а не показано нулем', () => {
  it('раніше читаний чат зник із діалогів → access_lost; решта читається, статус partial', async () => {
    const h = harness(W38 - WEEK);
    const before = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat'), chat('-1002', 'beta_chat')] });
    const w37 = await run(h.base(before, defaultState(), ['alpha_chat', 'beta_chat']));

    h.clock.t = W38;
    const after = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')] });
    const w38 = await run(h.base(after, w37.state, ['alpha_chat', 'beta_chat']));

    expect(w38.report.status).toBe('partial');
    expect(w38.report.failures).toEqual([
      { ref: 'beta_chat', title: 'Title -1002', reason: 'access_lost (no longer in dialogs)' },
    ]);
  });

  it('помилка доступу від Telegram на читанні → access_lost з кодом; помилка без типу → read_failed', async () => {
    const h = harness(W38);
    const port = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'alpha_chat'), chat('-1002', 'beta_chat'), chat('-1003', 'gamma_chat')],
      failures: { '-1002': [{ kind: 'access_lost', code: 'CHANNEL_PRIVATE' }], '-1003': [new TypeError('boom')] },
    });

    const result = await run(h.base(port, defaultState(), ['alpha_chat', 'beta_chat', 'gamma_chat']));

    expect(result.report.failures.map((f) => [f.ref, f.reason])).toEqual([
      ['beta_chat', 'access_lost (CHANNEL_PRIVATE)'],
      ['gamma_chat', 'read_failed (TypeError)'],
    ]);
    expect(result.report.status).toBe('partial');
  });

  it('жоден чат не прочитано → статус failed, а не completed із нулем', async () => {
    const h = harness(W38);
    const port = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'alpha_chat')],
      failures: { '-1001': [{ kind: 'failed', code: 'RPC_CALL_FAIL' }] },
    });

    expect((await run(h.base(port, defaultState(), ['alpha_chat']))).report.status).toBe('failed');
    expect((await run(harness(W38).base(port, defaultState(), ['never_joined']))).report.status).toBe('failed');
  });
});

describe('runCycle — AC-09 надолуження без дублів', () => {
  it('пропущений тиждень: наступний прогін читає від маркера, перетин на межі не дублюється', async () => {
    const h = harness(W38);
    const messages = { '-1001': [msg(1, W38 - DAY), msg(2, W38)] }; // #2 рівно на старті циклу — потрапить в обидва читання
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], messages });
    const w38 = await run(h.base(port, defaultState(), ['alpha_chat']));
    expect(w38.messages.map((m) => m.telegramMessageId)).toEqual([1, 2]);

    // W39 пропущено; повідомлення цього тижня мусять доїхати в W40.
    messages['-1001'].push(msg(3, W38 + WEEK + DAY));
    h.clock.t = W38 + 2 * WEEK;
    const w40 = await run(h.base(port, w38.state, ['alpha_chat']));

    expect(port.reads[1].since).toBe(iso(W38));
    expect(w40.messages.map((m) => m.telegramMessageId)).toEqual([3]);
    expect(w40.report.chats[0].newMessages).toBe(1);
  });

  it('повідомлення, що прийшло посеред циклу вже після читання свого чату, доїжджає наступним прогоном', async () => {
    const h = harness(W38);
    const messages = { '-1001': [msg(1, W38 - DAY)], '-1002': [] as RawMessage[] };
    messages['-1001'].push(msg(2, W38 + 5 * MIN)); // alpha прочитано о W38, beta — о W38+10хв
    const chats = [chat('-1001', 'alpha_chat'), chat('-1002', 'beta_chat')];
    const port = fakePort({ clock: h.clock, chats, messages, readTakesMs: 10 * MIN });
    const w38 = await run(h.base(port, defaultState(), ['alpha_chat', 'beta_chat']));
    expect(w38.messages.map((m) => m.telegramMessageId)).toEqual([1]);

    h.clock.t = W38 + WEEK;
    const w39 = await run(h.base(port, w38.state, ['alpha_chat', 'beta_chat']));

    // Маркер на фініші циклу (W38+20хв) пропустив би #2 назавжди.
    expect(w39.messages.map((m) => m.telegramMessageId)).toEqual([2]);
  });

  it('чат у dead-letter цього тижня наступного тижня дочитує і цей проміжок', async () => {
    const h = harness(W38 - WEEK);
    const messages = { '-1001': [msg(1, W38 - WEEK - DAY)] };
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], messages });
    const w37 = await run(h.base(port, defaultState(), ['alpha_chat']));

    messages['-1001'].push(msg(2, W38 - DAY));
    h.clock.t = W38;
    const failing = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'alpha_chat')],
      messages,
      failures: { '-1001': [{ kind: 'failed', code: 'TIMEOUT' }] },
    });
    const w38 = await run(h.base(failing, w37.state, ['alpha_chat']));
    expect(w38.report.status).toBe('failed');

    h.clock.t = W38 + WEEK;
    const w39 = await run(h.base(fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], messages }), w38.state, ['alpha_chat']));

    expect(w39.messages.map((m) => m.telegramMessageId)).toEqual([2]);
  });
});

describe('runCycle — AC-10 вікно backfill', () => {
  it('новий чат з історією довшою за вікно: лише останні 4 тижні, межу вікна названо', async () => {
    const h = harness(W38);
    const port = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'old_chat', 10)],
      messages: { '-1001': [msg(1, W38 - 6 * WEEK), msg(2, W38 - 3 * WEEK)] },
    });

    const result = await run(h.base(port, defaultState(), ['old_chat']));

    expect(port.reads[0].since).toBe(iso(W38 - 4 * WEEK));
    expect(result.messages.map((m) => m.telegramMessageId)).toEqual([2]);
    expect(result.report.chats[0].windowStartAt).toBe(iso(W38 - 4 * WEEK));
  });

  it('новий чат молодший за вікно: межі немає, бо обрізати нічого', async () => {
    const h = harness(W38);
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'young_chat', 2)], messages: { '-1001': [msg(1, W38 - WEEK)] } });

    expect((await run(h.base(port, defaultState(), ['young_chat']))).report.chats[0].windowStartAt).toBeNull();
  });

  it('відомий чат простояв довше за вікно: читання не глибше вікна, межу названо', async () => {
    const h = harness(W38 - 10 * WEEK);
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')] });
    const old = await run(h.base(port, defaultState(), ['alpha_chat']));

    h.clock.t = W38;
    const result = await run(h.base(port, old.state, ['alpha_chat']));

    expect(port.reads[1].since).toBe(iso(W38 - 4 * WEEK));
    expect(result.report.chats[0].windowStartAt).toBe(iso(W38 - 4 * WEEK));
  });
});

describe('runCycle — ADR-0002 черга FLOOD_WAIT по чатах', () => {
  it('пауза лише для чату з FLOOD_WAIT: інші читаються до його повтору', async () => {
    const h = harness(W38);
    const port = fakePort({
      clock: h.clock,
      chats: [chat('-1001', 'alpha_chat'), chat('-1002', 'beta_chat')],
      messages: { '-1001': [msg(1, W38 - DAY)], '-1002': [msg(2, W38 - DAY)] },
      failures: { '-1001': [{ kind: 'flood_wait', seconds: 30 }] },
    });

    const result = await run(h.base(port, defaultState(), ['alpha_chat', 'beta_chat']));

    expect(port.reads.map((r) => r.chatId)).toEqual(['-1001', '-1002', '-1001']);
    expect(h.sleeps).toEqual([30_000]);
    expect(result.report.status).toBe('completed');
  });

  it('третій FLOOD_WAIT поспіль → dead-letter з причиною, двічі чекали по X секунд', async () => {
    const h = harness(W38);
    const flood = { kind: 'flood_wait', seconds: 5 } as const;
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], failures: { '-1001': [flood, flood, flood] } });

    const result = await run(h.base(port, defaultState(), ['alpha_chat']));

    expect(h.sleeps).toEqual([5_000, 5_000]);
    expect(result.report.failures[0].reason).toBe(
      'Chat exhausted after 3 consecutive FLOOD_WAIT retries (last FLOOD_WAIT_X=5s); moving to dead letter queue'
    );
  });

  it('FLOOD_WAIT довший за ліміт циклу → dead-letter одразу, без години сну', async () => {
    const h = harness(W38);
    const port = fakePort({ clock: h.clock, chats: [chat('-1001', 'alpha_chat')], failures: { '-1001': [{ kind: 'flood_wait', seconds: 3600 }] } });

    const result = await run(h.base(port, defaultState(), ['alpha_chat']));

    expect(h.sleeps).toEqual([]);
    expect(result.report.failures[0].reason).toBe('FLOOD_WAIT_X=3600s exceeds the per-cycle limit of 600s; moving to dead letter queue');
  });
});
