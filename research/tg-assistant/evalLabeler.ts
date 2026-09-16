/**
 * Точність розмітки S-3 на органічних питаннях раунду 2.
 *
 *   node research/tg-assistant/evalLabeler.ts          — числа і мітка кожного питання, без тексту
 *   node research/tg-assistant/evalLabeler.ts --show   — плюс текст питання поруч із міткою
 *
 * Як і evalFilter.ts, запускає людина у свій термінал: сирі дампи агентові
 * закриті `deny`. Вхід — ті самі органічні A+ (SUMMARY-ROUND2.md §3 плюс
 * `labels-override.json`), розмічені чинною матрицею.
 *
 * Еталон — `research/tg-mining/coverage-override.json`, теж поза git:
 * `{"<id>": "covered" | "white_spot"}` для питань, де людина не згодна з
 * розміткою. Питання без запису рахується прийнятим: файл тримає лише
 * розбіжності, а не повну розмітку. Тому число має сенс лише після того, як
 * людина переглянула весь список `--show`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchPositives, parseDump, parsePositives } from './evalFilter.ts';
import { labelQuestion, loadMatrix, type QuestionLabel } from './labeler.ts';

export type Coverage = QuestionLabel['label'];

export interface CoverageRow {
  id: string;
  predicted: Coverage;
  expected: Coverage;
}

export function agreement(rows: readonly CoverageRow[]) {
  const agreed = rows.filter((r) => r.predicted === r.expected).length;
  const byLabel = (label: Coverage) => rows.filter((r) => r.expected === label);
  return {
    total: rows.length,
    agreed,
    rate: rows.length === 0 ? null : agreed / rows.length,
    /** Пропущена біла пляма дорожча за хибну: вона ховає прогалину продукту. */
    missedWhiteSpots: byLabel('white_spot').filter((r) => r.predicted === 'covered').length,
    falseWhiteSpots: byLabel('covered').filter((r) => r.predicted === 'white_spot').length,
  };
}

function main(): void {
  const show = process.argv.includes('--show');
  const root = dirname(fileURLToPath(import.meta.url));
  const miningDir = join(root, '..', 'tg-mining');
  const dataDir = join(miningDir, 'data-round2');
  const matrix = loadMatrix(join(root, '..', '..', 'app', 'lib', 'rules', 'rules.2026.json'));
  const readJson = <T>(name: string): T => (existsSync(join(miningDir, name)) ? JSON.parse(readFileSync(join(miningDir, name), 'utf8')) : {}) as T;
  const organicOverride = readJson<Record<string, boolean>>('labels-override.json');
  const coverageOverride = readJson<Record<string, Coverage>>('coverage-override.json');
  const positives = parsePositives(readFileSync(join(miningDir, 'SUMMARY-ROUND2.md'), 'utf8'));

  const rows: CoverageRow[] = [];
  const lines: string[] = [];
  const cited = new Map<string, number>();
  for (const chat of readdirSync(dataDir).sort()) {
    const dumpPath = join(dataDir, chat, 'dump.md');
    if (!existsSync(dumpPath)) continue;
    for (const record of parseDump(chat, readFileSync(dumpPath, 'utf8'))) {
      // Розмічаються питання, органічні за еталоном, а не за фільтром: помилка
      // фільтра вже названа в evalFilter.ts і не має двічі зсувати це число.
      if (!(organicOverride[record.id] ?? matchPositives(record, positives).length > 0)) continue;
      const label = labelQuestion(record.text, matrix, 'round2', '');
      const expected = coverageOverride[record.id] ?? label.label;
      rows.push({ id: record.id, predicted: label.label, expected });
      const rules = label.label === 'covered' ? label.ruleIds : [];
      for (const id of rules) cited.set(id, (cited.get(id) ?? 0) + 1);
      const mark = record.id in coverageOverride ? ` expected=${expected}` : '';
      const text = show ? `  ${record.text.replace(/\s+/g, ' ').slice(0, 200)}` : '';
      lines.push(`${record.id} ${label.label}${mark} ${rules.join('|')}${text}`);
    }
  }

  const a = agreement(rows);
  const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  console.log(`matrix verified_at=${matrix.verified_at} rules=${matrix.rules.length}`);
  console.log(`questions=${a.total} covered=${rows.filter((r) => r.predicted === 'covered').length} white_spot=${rows.filter((r) => r.predicted === 'white_spot').length} overrides=${Object.keys(coverageOverride).length}`);
  console.log(`agreement=${pct(a.rate)} missed_white_spots=${a.missedWhiteSpots} false_white_spots=${a.falseWhiteSpots}`);
  console.log(`cited: ${[...cited].sort((x, y) => y[1] - x[1]).map(([id, n]) => `${id}=${n}`).join(' ') || '-'}`);
  console.log('');
  for (const line of lines) console.log(line);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
