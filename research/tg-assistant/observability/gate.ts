/**
 * Ворота доказів перед чернеткою PR (урок 11.3). Звичайний код, без моделі.
 *
 * Агент на одноразовому раннері отримав звіт і чистий чекаут. Що б він не
 * сказав про свою роботу, тут перевіряється лише стан: які файли змінено, чи
 * не зачеплено нагляд, чи названо в нотатках аномалію, яку справді знайшов
 * детектор. `tsc` і тести ганяє workflow окремими кроками після цих воріт.
 *
 *   node gate.ts <report.json> <notes.md>   (changed files — stdin, по одному на рядок)
 *
 * Workflow запускає цей файл з копії, знятої ДО агента: інакше агент міг би
 * переписати самі ворота, і перевірку робив би вже змінений файл.
 *
 * Вихід: 0 і `proposal=true|false` у stdout; 1 — правка є, але показувати її не можна.
 */

import { existsSync, readFileSync } from 'node:fs';

/** Агент не може вимкнути сигналізацію, що його викликала, ані розширити собі права. */
export const PROTECTED_PREFIXES = [
  '.github/',
  '.claude/',
  'research/tg-assistant/observability/',
  'research/tg-assistant/Dockerfile',
  'research/tg-assistant/compose.vps.yml',
  'research/tg-assistant/package.json',
  'research/tg-assistant/package-lock.json',
  'research/tg-assistant/vitest.config.ts',
  'research/tg-assistant/tsconfig.json',
  'CLAUDE.md',
  'AGENTS.md',
] as const;

/** Еталон не підганяється під код (.claude/rules/testing.md): тести агент не чіпає зовсім. */
const isTestFile = (file: string) => file.endsWith('.test.ts');

/** Правка стосується лише колектора. Решта репо — не предмет цього нагляду. */
export const ALLOWED_PREFIX = 'research/tg-assistant/';

export type GateResult =
  | { verdict: 'no_proposal'; reason: string }
  | { verdict: 'rejected'; reason: string }
  | { verdict: 'proposal'; reason: string };

export interface GateInput {
  changedFiles: string[];
  /** Коди аномалій зі звіту детектора. */
  anomalyCodes: string[];
  /** Нотатки агента; null — файла немає. */
  notes: string | null;
}

export function checkProposal(input: GateInput): GateResult {
  const changed = input.changedFiles.map((f) => f.trim()).filter(Boolean);

  if (input.anomalyCodes.length === 0) {
    return { verdict: 'no_proposal', reason: 'report has no anomalies: nothing to fix' };
  }

  // Промпт вимагає нотаток і тоді, коли агент свідомо зупиняється. Немає нотаток —
  // агент не запустився або не дійшов до кінця, і «нуль змін» тут не рішення, а
  // тиша. Знайдено на першому живому навчанні: CLI впав до першого ходу, а
  // ворота назвали це «мало доказів» і дали зелений прогін.
  const notes = input.notes?.trim() ?? '';
  if (notes === '') {
    return { verdict: 'rejected', reason: 'agent left no notes: it did not run or did not finish' };
  }

  const protectedHits = changed.filter((f) => isTestFile(f) || PROTECTED_PREFIXES.some((p) => f === p || f.startsWith(p)));
  if (protectedHits.length > 0) {
    return { verdict: 'rejected', reason: `protected files touched: ${protectedHits.join(', ')}` };
  }
  const outside = changed.filter((f) => !f.startsWith(ALLOWED_PREFIX));
  if (outside.length > 0) {
    return { verdict: 'rejected', reason: `files outside ${ALLOWED_PREFIX}: ${outside.join(', ')}` };
  }

  if (changed.length === 0) {
    return { verdict: 'no_proposal', reason: 'agent changed nothing: not enough evidence for a fix' };
  }

  const cited = input.anomalyCodes.filter((code) => notes.includes(code));
  if (cited.length === 0) {
    return { verdict: 'no_proposal', reason: `notes cite none of the detected anomalies (${input.anomalyCodes.join(', ')})` };
  }

  return { verdict: 'proposal', reason: `${changed.length} file(s) changed, cites ${cited.join(', ')}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [reportPath, notesPath] = process.argv.slice(2);
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { anomalies?: Array<{ code: string }> };
  const result = checkProposal({
    changedFiles: readFileSync(0, 'utf8').split('\n'),
    anomalyCodes: (report.anomalies ?? []).map((a) => a.code),
    notes: notesPath && existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : null,
  });
  process.stdout.write(`gate: ${result.verdict} — ${result.reason}\n`);
  process.stdout.write(`proposal=${result.verdict === 'proposal'}\n`);
  process.exit(result.verdict === 'rejected' ? 1 : 0);
}
