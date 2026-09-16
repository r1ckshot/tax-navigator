/**
 * Точність фільтра S-2 на розмітці раунду 2.
 *
 *   node research/tg-assistant/evalFilter.ts          — лише числа
 *   node research/tg-assistant/evalFilter.ts --why    — плюс ознаки, що спрацювали на кожній помилці, без тексту
 *   node research/tg-assistant/evalFilter.ts --show   — плюс тексти розбіжностей і позитивів
 *
 * Сирі дампи (`research/tg-mining/data-round2/`) у git не йдуть, а агентові
 * закриті правилом `deny`. Тому скрипт запускає людина, у свій термінал: у
 * репо лишаються код і числа, тексти не виходять за межі машини.
 *
 * Еталон: позитиви — 25 органічних A+ з SUMMARY-ROUND2.md §3, негативи — решта
 * хітів тих самих дампів. Спірну мітку людина перебиває файлом
 * `research/tg-mining/labels-override.json` (`{"<id>": true|false}`), теж поза git.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, explain, type FilterInput } from './filter.ts';

export interface DumpRecord {
  /** `<chat>#<n>` — n за порядком унікальних текстів у дампі чату. */
  id: string;
  chat: string;
  date: string;
  source: string;
  text: string;
}

export interface Positive {
  date: string;
  snippet: string;
}

const normalizeText = (text: string) => text.toLocaleLowerCase('uk').replace(/\s+/g, ' ').trim();

/**
 * Дамп — послідовність записів `---` / frontmatter / `---` / текст. Один
 * текст повторюється під кожним ключовим словом, що його зачепило, тож запис
 * зводиться до унікального тексту — та сама одиниця, що AC-04.
 */
export function parseDump(chat: string, content: string): DumpRecord[] {
  const lines = content.split('\n');
  const records: DumpRecord[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== '---') {
      i += 1;
      continue;
    }
    const meta: Record<string, string> = {};
    let j = i + 1;
    while (j < lines.length && /^[a-z_]+:/.test(lines[j])) {
      const at = lines[j].indexOf(':');
      meta[lines[j].slice(0, at)] = lines[j].slice(at + 1).trim();
      j += 1;
    }
    if (j >= lines.length || lines[j].trim() !== '---' || !meta.date) {
      i += 1;
      continue;
    }
    let k = j + 1;
    while (k < lines.length && lines[k].trim() !== '---') k += 1;
    const text = lines.slice(j + 1, k).join('\n').trim();
    i = k;
    const key = `${meta.date}|${normalizeText(text)}`;
    if (!text || seen.has(key)) continue;
    seen.add(key);
    records.push({ id: `${chat}#${records.length + 1}`, chat, date: meta.date, source: meta.source ?? '', text });
  }
  return records;
}

/** Рядки виду `12. 2025-04-29 — "текст…` з розділу органічних A+ цитат. */
export function parsePositives(summary: string): Positive[] {
  const positives: Positive[] = [];
  for (const line of summary.split('\n')) {
    const match = /^\d+\.\s+(\d{4}-\d{2}-\d{2})\s+—\s+"(.*)$/.exec(line.trim());
    if (!match) continue;
    // Цитата буває обрізана з обох боків (`...`) — беремо шматок до першого обрізу.
    const snippet = normalizeText(match[2].replace(/^\.{3}/, '').split(/\.{3}|"/)[0]).slice(0, 40);
    if (snippet.length >= 10) positives.push({ date: match[1], snippet });
  }
  return positives;
}

/** Усі цитати, що збігаються із записом: той самий текст буває процитований двічі, з двох чатів. */
export function matchPositives(record: DumpRecord, positives: readonly Positive[]): Positive[] {
  const text = normalizeText(record.text);
  return positives.filter((p) => p.date === record.date && text.includes(p.snippet));
}

export function toFilterInput(record: DumpRecord, index: number): FilterInput {
  // Дамп раунду 2 не зберіг ні `out`, ні `fwdFrom`: ці ознаки тут не міряються.
  return { chatId: record.chat, telegramMessageId: index, text: record.text, outgoing: false, forwarded: false, channelPost: record.source === 'post' };
}

export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export function score(c: Confusion) {
  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);
  return { precision: ratio(c.tp, c.tp + c.fp), recall: ratio(c.tp, c.tp + c.fn), accuracy: ratio(c.tp + c.tn, c.tp + c.fp + c.fn + c.tn) };
}

function main(): void {
  const show = process.argv.includes('--show');
  const why = process.argv.includes('--why');
  const reasons: string[] = [];
  const miningDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tg-mining');
  const dataDir = join(miningDir, 'data-round2');
  const positives = parsePositives(readFileSync(join(miningDir, 'SUMMARY-ROUND2.md'), 'utf8'));
  const overridePath = join(miningDir, 'labels-override.json');
  const overrides: Record<string, boolean> = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, 'utf8')) : {};

  const confusion: Confusion = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const matched = new Set<Positive>();
  const mismatches: string[] = [];
  const positiveLines: string[] = [];
  let index = 0;

  for (const chat of readdirSync(dataDir).sort()) {
    const dumpPath = join(dataDir, chat, 'dump.md');
    if (!existsSync(dumpPath)) continue;
    for (const record of parseDump(chat, readFileSync(dumpPath, 'utf8'))) {
      const hits = matchPositives(record, positives);
      for (const hit of hits) matched.add(hit);
      const positive = hits.length > 0;
      const label = overrides[record.id] ?? positive;
      const verdict = classify(toFilterInput(record, (index += 1)));
      const snippet = record.text.replace(/\s+/g, ' ').slice(0, 160);
      if (positive || record.id in overrides) positiveLines.push(`${record.id} label=${label}${record.id in overrides ? ' (override)' : ''}  ${snippet}`);

      if (label !== verdict.isOrganic) {
        const e = explain(record.text);
        const kind = label ? 'FN' : 'FP';
        const verdictText = verdict.isOrganic ? 'organic' : verdict.reason;
        reasons.push(`${kind} ${record.id} [${verdictText}] source=${record.source} len=${e.length} contacts=${e.contacts} topic=${e.topic.join('|')} question=${e.question.join('|')} seller=${e.seller.join('|')} you=${e.secondPerson.join('|')} me=${e.firstPerson.join('|')}`);
      }
      if (label && verdict.isOrganic) confusion.tp += 1;
      else if (label) {
        confusion.fn += 1;
        mismatches.push(`FN ${record.id} [${(verdict as { reason: string }).reason}]  ${snippet}`);
      } else if (verdict.isOrganic) {
        confusion.fp += 1;
        mismatches.push(`FP ${record.id}  ${snippet}`);
      } else confusion.tn += 1;
    }
  }

  const s = score(confusion);
  const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  console.log(`records=${confusion.tp + confusion.fp + confusion.fn + confusion.tn} positives_in_summary=${positives.length} matched=${matched.size} overrides=${Object.keys(overrides).length}`);
  console.log(`tp=${confusion.tp} fp=${confusion.fp} fn=${confusion.fn} tn=${confusion.tn}`);
  console.log(`precision=${pct(s.precision)} recall=${pct(s.recall)} accuracy=${pct(s.accuracy)}`);
  const unmatched = positives.filter((p) => !matched.has(p));
  // Незнайдений позитив — не помилка фільтра, а дірка еталона: називаємо, не ковтаємо.
  if (unmatched.length > 0) console.log(`unmatched positives: ${unmatched.map((p) => p.date).join(', ')}`);
  if (why) {
    console.log('\n--- why (no message text) ---');
    for (const line of reasons) console.log(line);
  }
  if (show) {
    console.log('\n--- labelled positives ---');
    for (const line of positiveLines) console.log(line);
    console.log('\n--- mismatches ---');
    for (const line of mismatches) console.log(line);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
