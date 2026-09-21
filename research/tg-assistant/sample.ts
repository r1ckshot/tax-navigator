/**
 * Вибірка для міряння фільтра S-2 на живому циклі (POLISH, сесія 16).
 *
 * Цикл тексту на диск не пише (PRD §6.1), тож розмітити вже прочитане нема з
 * чого. `node main.ts sample` перечитує ті самі чати за те саме вікно, що й
 * останній цикл, бере лише повідомлення, які дедуп того циклу вже бачив, і
 * віддає їх у stdout разом із вердиктом фільтра. Стан не змінюється.
 *
 * Людина ставить `label` у кожному записі, `node evalSample.ts <файл>` рахує.
 * Вердикт фільтра лежить окремою мапою в кінці файла, а записи перемішані між
 * стратами: мітка, поставлена з вердиктом перед очима, міряла б згоду з ним.
 *
 * Відсіяних зазвичай на порядки більше, ніж органічних, і розмітити всі не
 * вийде. Тому вибірка стратифікована за причиною відсіву: органічні — всі,
 * у кожній страті відсіяних — не більше за ліміт, і пропуски фільтра
 * перераховуються на всю страту її вагою.
 */

import { filterBatch, type FilterInput, type RejectReason } from './filter.ts';
import { latestReport, type CycleReport, type CycleState } from './state.ts';

export interface SampleChat {
  chatId: string;
  ref: string;
  title: string;
  since: string;
  /** Скільки нових повідомлень цей чат дав циклу: звірка, що перечитано те саме. Null — чат цикл не прочитав. */
  expected: number | null;
  /** Брати лише повідомлення, які дедуп циклу вже бачив. Для непрочитаного чату таких немає. */
  onlySeen: boolean;
}

export interface SamplePlan {
  weekOf: string;
  until: string;
  chats: SampleChat[];
}

export type Stratum = 'organic' | RejectReason;

export interface SampleRecord {
  id: string;
  chat: string;
  postedAt: string;
  /** Ставить людина: true — органічне питання про власну ситуацію, false — ні. */
  label: boolean | null;
  text: string;
}

export interface SampleFile {
  weekOf: string;
  seed: number;
  /** Скільки повідомлень у кожній страті на весь цикл і скільки з них у вибірці. */
  strata: Record<string, { total: number; sampled: number }>;
  records: SampleRecord[];
  verdicts: Record<string, Stratum>;
}

export class SampleError extends Error {}

/** Причини, де фільтр найімовірніше помиляється: тема вже є, рішення тонке. */
const NEAR_MISS: readonly RejectReason[] = ['advert', 'not_question', 'not_own'];

export const DEFAULT_LIMITS = { nearMiss: 100, other: 20 } as const;

function previousReport(state: CycleState, report: CycleReport): CycleReport | null {
  const earlier = Object.values(state.reports ?? {}).filter((r) => r.startedAt < report.startedAt);
  return earlier.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0] ?? null;
}

export function planSample(state: CycleState, weekOf?: string): SamplePlan {
  const report = weekOf ? state.reports?.[weekOf] : latestReport(state);
  if (!report) throw new SampleError(weekOf ? `no cycle report for ${weekOf}` : 'no cycle report in state');
  const previous = previousReport(state, report);
  const idByRef = new Map(Object.entries(state.chats ?? {}).map(([id, marker]) => [marker.ref, id]));

  const chats = report.chats.map((chat) => {
    const chatId = idByRef.get(chat.ref);
    if (!chatId) throw new SampleError(`chat ${chat.ref} from the report has no marker in state`);
    // Перше читання чату починалось з межі вікна, решта — з попереднього циклу.
    const since = chat.windowStartAt ?? previous?.startedAt;
    if (!since) throw new SampleError(`chat ${chat.ref}: no window start and no earlier cycle to read from`);
    return { chatId, ref: chat.ref, title: chat.title, since, expected: chat.newMessages, onlySeen: true };
  });
  return { weekOf: report.weekOf, until: report.startedAt, chats };
}

/**
 * Чат, який цикл не дочитав (FLOOD_WAIT, збій). Маркер при збої не зсувається,
 * тож `lastReadAt` — рівно те місце, звідки цикл мав читати; межа — старт циклу.
 * Дедуп цих повідомлень не бачив, тож фільтр вибірки за ним не застосовується.
 */
export function planFailedChat(state: CycleState, ref: string, weekOf?: string): SamplePlan {
  const report = weekOf ? state.reports?.[weekOf] : latestReport(state);
  if (!report) throw new SampleError(weekOf ? `no cycle report for ${weekOf}` : 'no cycle report in state');
  const failure = report.failures.find((f) => f.ref === ref);
  if (!failure) throw new SampleError(`chat ${ref} did not fail in ${report.weekOf}: sample it without --chat`);
  const entry = Object.entries(state.chats ?? {}).find(([, marker]) => marker.ref === ref);
  if (!entry) throw new SampleError(`chat ${ref} has no marker in state`);
  const [chatId, marker] = entry;
  return {
    weekOf: report.weekOf,
    until: report.startedAt,
    chats: [{ chatId, ref, title: marker.title, since: marker.lastReadAt, expected: null, onlySeen: false }],
  };
}

/** Детермінований генератор: те саме зерно — та сама вибірка, її можна відтворити. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], count: number, random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export interface SampleMessage extends FilterInput {
  chatTitle: string;
  postedAt: string;
}

export function drawSample(
  weekOf: string,
  messages: readonly SampleMessage[],
  seed: number,
  limits: { nearMiss: number; other: number } = DEFAULT_LIMITS
): SampleFile {
  const random = mulberry32(seed);
  const byStratum = new Map<Stratum, SampleMessage[]>();
  for (const message of filterBatch(messages).classified) {
    const stratum: Stratum = message.isOrganic ? 'organic' : message.reason;
    byStratum.set(stratum, [...(byStratum.get(stratum) ?? []), message]);
  }

  const strata: SampleFile['strata'] = {};
  const records: SampleRecord[] = [];
  const verdicts: SampleFile['verdicts'] = {};
  for (const [stratum, items] of [...byStratum.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const limit = stratum === 'organic' ? items.length : NEAR_MISS.includes(stratum) ? limits.nearMiss : limits.other;
    const chosen = pick(items, limit, random);
    strata[stratum] = { total: items.length, sampled: chosen.length };
    for (const m of chosen) {
      const id = `${m.chatId}:${m.telegramMessageId}`;
      records.push({ id, chat: m.chatTitle, postedAt: m.postedAt, label: null, text: m.text });
      verdicts[id] = stratum;
    }
  }
  return { weekOf, seed, strata, records: pick(records, records.length, random), verdicts };
}

export interface SampleScore {
  unlabelled: number;
  tp: number;
  fp: number;
  /** Пропуски фільтра, знайдені у вибірці, за стратою. */
  fnSampled: Record<string, number>;
  /** Ті самі пропуски, перераховані на весь цикл вагою страти. */
  fnEstimated: number;
  precision: number | null;
  recall: number | null;
}

export function scoreSample(file: SampleFile): SampleScore {
  let tp = 0;
  let fp = 0;
  let unlabelled = 0;
  const fnSampled: Record<string, number> = {};
  for (const record of file.records) {
    if (record.label === null) {
      unlabelled += 1;
      continue;
    }
    const verdict = file.verdicts[record.id];
    if (verdict === undefined) throw new SampleError(`record ${record.id} has no verdict`);
    if (verdict === 'organic') {
      if (record.label) tp += 1;
      else fp += 1;
    } else if (record.label) fnSampled[verdict] = (fnSampled[verdict] ?? 0) + 1;
  }
  let fnEstimated = 0;
  for (const [stratum, fn] of Object.entries(fnSampled)) {
    const { total, sampled } = file.strata[stratum];
    fnEstimated += (fn * total) / sampled;
  }
  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);
  return { unlabelled, tp, fp, fnSampled, fnEstimated, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fnEstimated) };
}
