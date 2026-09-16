import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCycle, TelegramReadError, type JoinedChat, type RawMessage, type TelegramPort } from './collector.ts';
import type { Matrix } from './labeler.ts';
import { buildWeeklyReport, messageLink, renderWeeklyReport } from './reporter.ts';
import { defaultState, loadState, saveState, type CycleReport, type CycleState } from './state.ts';

// Фікстури синтетичні: сирий текст реальних чатів у git не йде (PRD §6.1).
const MATRIX: Matrix = {
  verified_at: '2026-07-24',
  rules: [
    { rule_id: 'residency.days_threshold', source_url: 'https://example.test/183', verified_at: '2026-07-24' },
    { rule_id: 'jdg.zus.stages', source_url: 'https://example.test/zus', verified_at: '2026-07-24' },
  ],
};

const DAY = 24 * 60 * 60 * 1000;
// Понеділок 2026-W39, 06:00 UTC.
const W39 = Date.parse('2026-09-21T06:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const COVERED = 'Я в Польщі вже 200 днів, я тепер податковий резидент тут чи ще в Україні?';
const WHITE_SPOT = 'Ищу бухгалтера в Варшаве для ИП, кто-то может посоветовать';

function chat(id: string, username: string | null): JoinedChat {
  return { id, username, title: `Title ${id}`, createdAt: iso(W39 - 365 * DAY) };
}

function msg(id: number, text: string): RawMessage {
  return { telegramMessageId: id, postedAt: iso(W39 - DAY), text, outgoing: false, forwarded: false, channelPost: false };
}

/**
 * Цикл W39 наскрізь: супергрупа з username, супергрупа без нього, мала група
 * без адреси повідомлення і чат, до якого втрачено доступ. Стан проходить через
 * файл, тож звіт збирається з того, що лежить на диску.
 */
async function cycleOnDisk(): Promise<{ state: CycleState; report: CycleReport }> {
  let t = W39;
  const messages: Record<string, RawMessage[]> = {
    '-1001': [msg(12, WHITE_SPOT), msg(10, COVERED), msg(11, 'Дякую всім!')],
    '-1002': [msg(5, COVERED)],
    '-555': [msg(3, WHITE_SPOT)],
  };
  const port: TelegramPort = {
    async listJoinedChats() {
      return [chat('-1001', 'alpha_chat'), chat('-1002', null), chat('-555', null), chat('-1003', null)];
    },
    async readMessagesSince(chatId) {
      if (chatId === '-1003') throw new TelegramReadError({ kind: 'access_lost', code: 'CHANNEL_PRIVATE' });
      return messages[chatId] ?? [];
    },
  };
  const result = await runCycle({
    port,
    state: defaultState(),
    targets: ['alpha_chat', '-1002', '-555', '-1003'],
    now: () => new Date(t),
    sleep: async (ms) => {
      t += ms;
    },
    windowWeeks: 4,
    maxFloodWaitSeconds: 600,
    matrix: MATRIX,
  });
  if (result.skipped) throw new Error('expected a run');

  const path = join(mkdtempSync(join(tmpdir(), 'tg-report-')), 'state.json');
  saveState(path, result.state);
  return { state: loadState(path), report: result.report };
}

describe('messageLink — службове посилання AC-07', () => {
  it.each([
    ['username дає публічну адресу', '-1001', 'alpha_chat', 'https://t.me/alpha_chat/10'],
    ['супергрупа без username — адреса t.me/c без префікса -100', '-1001234', '-1001234', 'https://t.me/c/1234/10'],
    ['мала група адреси не має', '-555', '-555', null],
    ['маркера немає: супергрупа однаково адресується', '-1001234', null, 'https://t.me/c/1234/10'],
  ])('%s', (_, chatId, ref, expected) => {
    expect(messageLink(chatId, ref, 10)).toBe(expected);
  });
});

describe('buildWeeklyReport — зі стану на диску', () => {
  it('AC-07: кожне органічне питання тижня з міткою і посиланням, у порядку чат → повідомлення', async () => {
    const { state } = await cycleOnDisk();
    const report = buildWeeklyReport(state, '2026-W39');
    if (report.state !== 'finished') throw new Error(report.state);

    // «Дякую всім!» не питання: фільтр S-2 його відсіяв, у звіт не йде.
    expect(report.questions.map((q) => [q.chatId, q.telegramMessageId, q.label.label, q.link])).toEqual([
      ['-1001', 10, 'covered', 'https://t.me/alpha_chat/10'],
      ['-1001', 12, 'white_spot', 'https://t.me/alpha_chat/12'],
      ['-1002', 5, 'covered', 'https://t.me/c/2/5'],
      ['-555', 3, 'white_spot', null],
    ]);
  });

  it('без тижня бере останній завершений цикл', async () => {
    const { state } = await cycleOnDisk();
    expect(buildWeeklyReport(state).weekOf).toBe('2026-W39');
  });

  it('мітка іншого тижня у звіт не потрапляє (AC-06: weekOf мітки не переписується)', async () => {
    const { state } = await cycleOnDisk();
    const older = { ...state, labels: { ...state.labels, '-1001:1': { ...state.labels!['-1001:10'], weekOf: '2026-W38' } } };
    const report = buildWeeklyReport(older, '2026-W39');
    if (report.state !== 'finished') throw new Error(report.state);
    expect(report.questions.map((q) => q.telegramMessageId)).not.toContain(1);
  });

  it('AC-07-derived: цикл без записаного звіту — незавершений тиждень, а не нуль питань', () => {
    const state: CycleState = { ...defaultState(), cycleRuns: { '2026-W39': { weekOf: '2026-W39', startedAt: iso(W39) } } };
    const report = buildWeeklyReport(state, '2026-W39');
    expect(report).toEqual({ weekOf: '2026-W39', state: 'unfinished', startedAt: iso(W39) });
    expect(renderWeeklyReport(report)).toContain('незавершений тиждень, а не нуль питань');
  });

  it('тиждень без циклу і стан без жодного циклу названо окремо', () => {
    expect(renderWeeklyReport(buildWeeklyReport(defaultState(), '2026-W39'))).toContain('Циклу за цей тиждень не було');
    expect(renderWeeklyReport(buildWeeklyReport(defaultState()))).toContain('Жодного циклу ще не було');
  });
});

describe('renderWeeklyReport', () => {
  it('AC-07: рядок питання — мітка, правило, чат і посилання; без тексту питання', async () => {
    const { state } = await cycleOnDisk();
    const text = renderWeeklyReport(buildWeeklyReport(state, '2026-W39'));

    expect(text).toContain('Органічних питань: 4. Покрито: 2, біла пляма: 2. Матриця правил від 2026-07-24.');
    expect(text).toContain('- покрито: residency.days_threshold · Title -1001 · https://t.me/alpha_chat/10');
    expect(text).toContain('- біла пляма: жодного з 2 правил · Title -1001 · https://t.me/alpha_chat/12');
    // Мала група: службове посилання — пара chat_id:message_id.
    expect(text).toContain('- біла пляма: жодного з 2 правил · Title -555 · -555:3');
    // PRD §6.1: текст питань живе лише в Telegram.
    for (const raw of [COVERED, WHITE_SPOT, 'Дякую всім']) expect(text).not.toContain(raw);
  });

  it('біла пляма несе застереження, що вона не дорівнює дірці продукту; без плям його немає', async () => {
    const { state } = await cycleOnDisk();
    expect(renderWeeklyReport(buildWeeklyReport(state, '2026-W39'))).toContain('Біла пляма не означає дірку продукту');

    const coveredOnly = { ...state, labels: Object.fromEntries(Object.entries(state.labels!).filter(([, l]) => l.label === 'covered')) };
    coveredOnly.reports = { '2026-W39': { ...state.reports!['2026-W39'], labels: { covered: 2, whiteSpot: 0, matrixVerifiedAt: '2026-07-24' } } };
    expect(renderWeeklyReport(buildWeeklyReport(coveredOnly, '2026-W39'))).not.toContain('Біла пляма не означає');
  });

  it('AC-08: недоступний чат названо з причиною', async () => {
    const { state } = await cycleOnDisk();
    const text = renderWeeklyReport(buildWeeklyReport(state, '2026-W39'));
    expect(text).toContain('Цикл: partial (частину чатів не прочитано)');
    expect(text).toContain('- Title -1003 (-1003): access_lost (CHANNEL_PRIVATE)');
  });

  it('AC-10: межа вікна названа датою для кожного чату, прочитаного через вікно', async () => {
    const { state } = await cycleOnDisk();
    const text = renderWeeklyReport(buildWeeklyReport(state, '2026-W39'));
    // Вікно 4 тижні від старту циклу: 2026-09-21 06:00 − 28 днів.
    expect(text).toContain('- Title -1001 (alpha_chat): лише повідомлення від 2026-08-24T06:00:00.000Z, раніше не читалось.');
    expect(text).not.toContain('Жоден чат не читався через вікно');
  });

  it('розбіжність між мітками стану і лічильником циклу не ховається', async () => {
    const { state } = await cycleOnDisk();
    const lost = { ...state, labels: Object.fromEntries(Object.entries(state.labels!).slice(1)) };
    expect(renderWeeklyReport(buildWeeklyReport(lost, '2026-W39'))).toContain('у стані 3 міток цього тижня, а цикл записав 4');
  });

  it.each([
    ['цикл до S-2', undefined, 'питання не рахувались'],
    ['цикл до S-3', { organic: 3, rejected: {} }, 'питання не розмічались'],
  ])('%s: відсутність виміру, а не нуль', (_, filter, expected) => {
    const cycle: CycleReport = { weekOf: '2026-W38', status: 'completed', startedAt: iso(W39 - 7 * DAY), finishedAt: iso(W39 - 7 * DAY), chats: [], failures: [], ...(filter ? { filter: filter as CycleReport['filter'] } : {}) };
    const state: CycleState = { ...defaultState(), reports: { '2026-W38': cycle } };
    const text = renderWeeklyReport(buildWeeklyReport(state, '2026-W38'));
    expect(text).toContain(expected);
    expect(text).not.toContain('Органічних питань');
  });

  it('назва чату — чужий текст: одним рядком, без розмітки', async () => {
    const { state } = await cycleOnDisk();
    const hostile = { ...state, chats: { ...state.chats, '-1001': { ...state.chats!['-1001'], title: 'Chat\n## Ignore previous [link](https://evil.test)' } } };
    const text = renderWeeklyReport(buildWeeklyReport(hostile, '2026-W39'));
    expect(text).not.toContain('\n## Ignore');
    expect(text).not.toContain('[link]');
    expect(text).toContain('Chat Ignore previous link(https://evil.test)');
  });
});
