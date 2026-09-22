/**
 * Розмітка вибірки (sample.ts) у терміналі: один текст за раз, y / n.
 *
 *   node research/tg-assistant/labelSample.ts <файл>          — з першого нерозміченого
 *   node research/tg-assistant/labelSample.ts <файл> --redo   — усі з початку, поточна мітка видна
 *
 * y — людина питає про власну податкову чи бізнес-ситуацію, і продукт на це
 * відповідає; w — питає, але продукт не відповідає (біла пляма); n — не власне
 * питання (відповідь іншому, реклама, вакансія, болтовня); s — пропустити;
 * b — назад; q — вийти. Мітка пишеться у файл після кожної відповіді, тож
 * вийти можна будь-коли і продовжити з першого нерозміченого запису.
 * Вердикт фільтра не показується: мітка мусить бути незалежною від нього.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { SampleFile } from './sample.ts';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write('usage: node labelSample.ts <sample.json>\n');
    process.exit(2);
  }
  const file = JSON.parse(readFileSync(path, 'utf8')) as SampleFile;
  const save = () => writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  const rl = createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt: string) => {
    process.stdout.write(prompt);
    const next = await lines.next();
    return next.done ? 'q' : next.value;
  };

  let i = process.argv.includes('--redo') ? 0 : file.records.findIndex((r) => r.label === null);
  if (i === -1) i = file.records.length;
  while (i < file.records.length) {
    const r = file.records[i];
    const done = file.records.filter((x) => x.label !== null).length;
    console.log(`\n──── ${i + 1}/${file.records.length}  (розмічено ${done})  ${r.chat}  ${r.postedAt.slice(0, 10)}${r.label === null ? '' : `  зараз: ${r.label ? (r.gap ? 'w' : 'y') : 'n'}`}`);
    console.log(r.text);
    const answer = (await ask('питання про свою ситуацію? y — так / w — так, але продукт не відповідає / n — ні [y/w/n/s/b/q] ')).trim().toLowerCase();
    if (answer === 'q') break;
    if (answer === 'b') {
      i = Math.max(0, i - 1);
      continue;
    }
    if (answer === 'y' || answer === 'w' || answer === 'n') {
      r.label = answer !== 'n';
      if (answer === 'n') delete r.gap;
      else r.gap = answer === 'w';
      save();
    } else if (answer !== 's') continue;
    i += 1;
  }
  rl.close();
  const left = file.records.filter((x) => x.label === null).length;
  console.log(left === 0 ? '\nусе розмічено' : `\nлишилось без мітки: ${left}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
