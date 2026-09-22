/**
 * Точність фільтра S-2 на розміченій вибірці живого циклу (sample.ts).
 *
 *   node research/tg-assistant/evalSample.ts <файл>          — лише числа
 *   node research/tg-assistant/evalSample.ts <файл> --why    — плюс ознаки фільтра на кожній помилці, без тексту
 *   node research/tg-assistant/evalSample.ts <файл> --show   — плюс тексти помилок
 *
 * Файл вибірки лежить поза git (`research/tg-mining/data/`, агентові закрито
 * `deny`), тож скрипт запускає людина. У репо йдуть лише числа.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { explain } from './filter.ts';
import { scoreSample, type SampleFile } from './sample.ts';

function main(): void {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write('usage: node evalSample.ts <sample.json> [--show]\n');
    process.exit(2);
  }
  const file = JSON.parse(readFileSync(path, 'utf8')) as SampleFile;
  const s = scoreSample(file);
  const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
  const fnTotal = Object.values(s.fnSampled).reduce((a, b) => a + b, 0);

  console.log(`week=${file.weekOf} seed=${file.seed} records=${file.records.length} unlabelled=${s.unlabelled}`);
  for (const [stratum, { total, sampled }] of Object.entries(file.strata)) {
    console.log(`  ${stratum}: ${sampled}/${total} sampled${s.fnSampled[stratum] ? `, missed ${s.fnSampled[stratum]}` : ''}`);
  }
  console.log(`tp=${s.tp} fp=${s.fp} fn_sampled=${fnTotal} fn_estimated=${s.fnEstimated.toFixed(1)}`);
  console.log(`precision=${pct(s.precision)} recall=${pct(s.recall)}`);
  // Неповна розмітка дає число, яке виглядає остаточним. Тому воно не рахується.
  if (s.unlabelled > 0) {
    console.log(`not final: ${s.unlabelled} records still have "label": null`);
    process.exitCode = 1;
  }
  // Ознаки без тексту: їх можна показати агентові, якому самі тексти закриті.
  if (process.argv.includes('--why')) {
    console.log('\n--- why (no message text) ---');
    for (const r of file.records) {
      const verdict = file.verdicts[r.id];
      if (r.label === null || r.label === (verdict === 'organic')) continue;
      const e = explain(r.text);
      console.log(`${r.label ? 'FN' : 'FP'} ${r.id} [${verdict}] len=${e.length} contacts=${e.contacts} topic=${e.topic.join('|')} question=${e.question.join('|')} seller=${e.seller.join('|')} you=${e.secondPerson.join('|')} me=${e.firstPerson.join('|')}`);
    }
  }
  if (process.argv.includes('--show')) {
    console.log('\n--- mismatches ---');
    for (const r of file.records) {
      const verdict = file.verdicts[r.id];
      if (r.label === null || r.label === (verdict === 'organic')) continue;
      console.log(`${r.label ? 'FN' : 'FP'} ${r.id} [${verdict}]  ${r.text.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
