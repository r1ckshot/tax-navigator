import { describe, expect, it } from 'vitest';
import { drawSample, planFailedChat, planSample, SampleError, scoreSample, type SampleFile, type SampleMessage, type SampleRecord, type Stratum } from './sample.ts';
import type { CycleReport, CycleState } from './state.ts';

// Фікстури синтетичні: сирий текст реальних чатів у git не йде (PRD §6.1).
function report(weekOf: string, startedAt: string, chats: CycleReport['chats']): CycleReport {
  return { weekOf, status: 'completed', startedAt, finishedAt: startedAt, chats, failures: [] };
}

const W38 = report('2026-W38', '2026-09-14T06:00:00.000Z', [{ ref: 'old_chat', title: 'Old', newMessages: 7, windowStartAt: '2026-08-17T06:00:00.000Z' }]);
const W39 = report('2026-W39', '2026-09-21T06:00:00.000Z', [
  { ref: 'old_chat', title: 'Old', newMessages: 12, windowStartAt: null },
  { ref: 'new_chat', title: 'New', newMessages: 3, windowStartAt: '2026-08-24T06:00:00.000Z' },
]);

function state(overrides: Partial<CycleState> = {}): CycleState {
  return {
    cycleRuns: {},
    seenMessages: {},
    chats: {
      '-1001': { ref: 'old_chat', title: 'Old', firstReadAt: W38.startedAt, lastReadAt: W39.startedAt },
      '-1002': { ref: 'new_chat', title: 'New', firstReadAt: W39.startedAt, lastReadAt: W39.startedAt },
    },
    // Порядок ключів навмисно не хронологічний: останній цикл береться за часом.
    reports: { '2026-W39': W39, '2026-W38': W38 },
    ...overrides,
  };
}

describe('planSample', () => {
  it('останній цикл: відомий чат — від попереднього циклу, новий — від межі вікна', () => {
    expect(planSample(state())).toEqual({
      weekOf: '2026-W39',
      until: '2026-09-21T06:00:00.000Z',
      chats: [
        { chatId: '-1001', ref: 'old_chat', title: 'Old', since: '2026-09-14T06:00:00.000Z', expected: 12, onlySeen: true },
        { chatId: '-1002', ref: 'new_chat', title: 'New', since: '2026-08-24T06:00:00.000Z', expected: 3, onlySeen: true },
      ],
    });
  });

  it('названий тиждень бере саме його', () => {
    const plan = planSample(state(), '2026-W38');
    expect(plan.until).toBe('2026-09-14T06:00:00.000Z');
    expect(plan.chats.map((c) => [c.chatId, c.since])).toEqual([['-1001', '2026-08-17T06:00:00.000Z']]);
  });

  it('тижня немає у стані — помилка з назвою тижня', () => {
    expect(() => planSample(state(), '2026-W40')).toThrow(new SampleError('no cycle report for 2026-W40'));
  });

  it('стан без звітів — помилка, а не порожня вибірка', () => {
    expect(() => planSample(state({ reports: {} }))).toThrow(SampleError);
  });

  it('чат зі звіту без маркера — помилка: невідомо, який id читати', () => {
    expect(() => planSample(state({ chats: {} }))).toThrow('chat old_chat from the report has no marker in state');
  });

  it('відомий чат без попереднього циклу — помилка, а не читання з початку чату', () => {
    expect(() => planSample(state({ reports: { '2026-W39': W39 } }))).toThrow('chat old_chat: no window start and no earlier cycle to read from');
  });
});

describe('planFailedChat', () => {
  // Великий чат упав на FLOOD_WAIT: у звіті він лише у failures, маркер лишився
  // на останньому успішному читанні (2026-09-14), бо при збої цикл його не зсуває.
  const W39_PARTIAL: CycleReport = { ...W39, status: 'partial', failures: [{ ref: 'big_chat', title: 'Big', reason: 'FLOOD_WAIT' }] };
  const withFailure = () =>
    state({
      chats: { ...state().chats, '-1003': { ref: 'big_chat', title: 'Big', firstReadAt: W38.startedAt, lastReadAt: '2026-09-14T06:00:00.000Z' } },
      reports: { '2026-W38': W38, '2026-W39': W39_PARTIAL },
    });

  it('читає від маркера до старту циклу, без обмеження дедупом', () => {
    expect(planFailedChat(withFailure(), 'big_chat')).toEqual({
      weekOf: '2026-W39',
      until: '2026-09-21T06:00:00.000Z',
      chats: [{ chatId: '-1003', ref: 'big_chat', title: 'Big', since: '2026-09-14T06:00:00.000Z', expected: null, onlySeen: false }],
    });
  });

  it('чат, який цикл прочитав, — помилка: для нього є звичайна вибірка', () => {
    expect(() => planFailedChat(withFailure(), 'old_chat')).toThrow('chat old_chat did not fail in 2026-W39: sample it without --chat');
  });

  // 2026-09-21: `itwarsawcommunity` не прочитався жодного разу, маркера в нього немає.
  it('чат без маркера — тиждень до старту циклу, id шукатимуть серед діалогів', () => {
    const s = withFailure();
    delete s.chats?.['-1003'];
    expect(planFailedChat(s, 'big_chat').chats).toEqual([
      { chatId: null, ref: 'big_chat', title: 'Big', since: '2026-09-14T06:00:00.000Z', expected: null, onlySeen: false },
    ]);
  });
});

const ORGANIC = 'Підкажіть, чи треба платити ZUS, якщо я на JDG і ще працюю по UoP?';
const OFF_TOPIC = 'Підкажіть, де у Варшаві зняти квартиру недорого?';
const NOT_QUESTION = 'Я на JDG вже третій рік, ZUS плачу сам.';

function message(id: number, text: string): SampleMessage {
  return { chatId: '-1001', telegramMessageId: id, text, outgoing: false, forwarded: false, channelPost: false, chatTitle: 'Old', postedAt: '2026-09-15T10:00:00.000Z' };
}

function batch(): SampleMessage[] {
  const messages: SampleMessage[] = [];
  let id = 0;
  for (let i = 0; i < 3; i += 1) messages.push(message((id += 1), ORGANIC));
  for (let i = 0; i < 30; i += 1) messages.push(message((id += 1), OFF_TOPIC));
  for (let i = 0; i < 8; i += 1) messages.push(message((id += 1), NOT_QUESTION));
  messages.push({ ...message((id += 1), ORGANIC), forwarded: true });
  return messages;
}

describe('drawSample', () => {
  const limits = { nearMiss: 5, other: 4 };

  it('органічні — всі, страти відсіяних — до свого ліміту, решта названа в total', () => {
    const file = drawSample('2026-W39', batch(), 7, limits);
    expect(file.strata).toEqual({
      not_question: { total: 8, sampled: 5 },
      off_topic: { total: 30, sampled: 4 },
      organic: { total: 3, sampled: 3 },
      repost: { total: 1, sampled: 1 },
    });
    expect(file.records).toHaveLength(13);
    expect(file.records.every((r) => r.label === null)).toBe(true);
    const organic = Object.keys(file.verdicts).filter((id) => file.verdicts[id] === 'organic');
    expect(organic.sort()).toEqual(['-1001:1', '-1001:2', '-1001:3']);
  });

  it('вердикту в записі немає, і страти перемішані: мітка не тягнеться за фільтром', () => {
    const file = drawSample('2026-W39', batch(), 7, limits);
    expect(file.records.every((r) => !('verdict' in r))).toBe(true);
    expect(Object.keys(file.verdicts).sort()).toEqual(file.records.map((r) => r.id).sort());
    const order = file.records.map((r) => file.verdicts[r.id]);
    const grouped = [...order].sort();
    expect(order).not.toEqual(grouped);
  });

  it('те саме зерно — та сама вибірка; інше зерно — інша', () => {
    const ids = (seed: number) => drawSample('2026-W39', batch(), seed, limits).records.map((r) => r.id);
    expect(ids(7)).toEqual(ids(7));
    expect(ids(7)).not.toEqual(ids(8));
  });

  it('повтор того самого повідомлення рахується один раз (AC-04)', () => {
    const file = drawSample('2026-W39', [message(1, ORGANIC), message(1, ORGANIC)], 1, limits);
    expect(file.strata).toEqual({ organic: { total: 1, sampled: 1 } });
  });
});

type Labelled = [Stratum, boolean | null];

function sampleFile(strata: SampleFile['strata'], labelled: Labelled[]): SampleFile {
  const records: SampleRecord[] = labelled.map(([, label], i) => ({ id: `-1001:${i + 1}`, chat: 'Old', postedAt: '2026-09-15T10:00:00.000Z', label, text: '' }));
  const verdicts = Object.fromEntries(labelled.map(([verdict], i) => [`-1001:${i + 1}`, verdict]));
  return { weekOf: '2026-W39', seed: 1, strata, records, verdicts };
}

const many = (n: number, verdict: Stratum, label: boolean): Labelled[] => Array.from({ length: n }, () => [verdict, label]);

describe('scoreSample', () => {
  it('пропуски перераховуються вагою страти', () => {
    // Еталон вручну:
    //   organic 4 записи, мітки T T T F           → tp 3, fp 1, precision 3/4 = 75%
    //   off_topic 1 пропуск із 10 вибраних на 100 → 1 · 100/10 = 10
    //   not_question 1 пропуск із 5 на 5         → 1 · 5/5 = 1
    //   fn_estimated = 11, recall = 3 / (3 + 11) = 3/14
    const file = sampleFile({ organic: { total: 4, sampled: 4 }, off_topic: { total: 100, sampled: 10 }, not_question: { total: 5, sampled: 5 } }, [
      ...many(3, 'organic', true),
      ['organic', false],
      ['off_topic', true],
      ...many(9, 'off_topic', false),
      ['not_question', true],
      ...many(4, 'not_question', false),
    ]);
    const s = scoreSample(file);
    expect(s).toMatchObject({ unlabelled: 0, tp: 3, fp: 1, fnSampled: { off_topic: 1, not_question: 1 }, fnEstimated: 11 });
    expect(s.precision).toBe(0.75);
    expect(s.recall).toBeCloseTo(3 / 14, 10);
  });

  it('нерозмічені записи не рахуються і названі окремо', () => {
    const file = sampleFile({ organic: { total: 2, sampled: 2 } }, [['organic', true], ['organic', null]]);
    expect(scoreSample(file)).toMatchObject({ unlabelled: 1, tp: 1, fp: 0, precision: 1, recall: 1 });
  });

  it('жодного органічного — precision n/a, а не 0 чи 100%', () => {
    const file = sampleFile({ off_topic: { total: 3, sampled: 3 } }, [['off_topic', false]]);
    expect(scoreSample(file)).toMatchObject({ precision: null, recall: null });
  });

  it('запис без вердикту — помилка, а не мовчазний негатив', () => {
    const file = sampleFile({ organic: { total: 1, sampled: 1 } }, [['organic', true]]);
    file.verdicts = {};
    expect(() => scoreSample(file)).toThrow('record -1001:1 has no verdict');
  });
});
