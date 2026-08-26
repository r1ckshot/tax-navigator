#!/usr/bin/env node
/**
 * Ціна прогону в токенах: субагенти під лідом проти команди пірів (урок 10.4).
 *
 * Питання уроку — «скільки коштує координація», і відповідати на нього оцінкою
 * не можна: тіммейт це повна сесія Claude Code, тобто ще один рахунок, і
 * побачити його можна лише в транскриптах. Кожен рядок транскрипту
 * (`~/.claude/projects/<проєкт>/**\/*.jsonl`) несе `message.usage` — те саме,
 * що показує білінг. Скрипт підсумовує його за вікном часу, тож обидві гілки
 * (спершу субагенти, потім команда) міряються однаково.
 *
 * Запуск:
 *   node scripts/agent-token-cost.mjs --since 2026-08-26T13:00:00Z [--until …] [--label subagents]
 *
 * Що показує:
 *   свіжі  = input + cache_creation — те, що модель прочитала вперше;
 *   cached = cache_read — повторне читання того самого контексту (дешевше в
 *            рази, але саме воно показує, скільки разів контекст перечитано);
 *   output = згенеровані токени.
 *
 * Розкладка по ролях іде за ШЛЯХОМ транскрипту, не за `sessionId`: субагент
 * пише в `<сесія>/subagents/agent-*.jsonl` і несе `sessionId` БАТЬКА, тож
 * групування по sessionId злило б субагентів із лідом в один рядок. Тіммейт,
 * навпаки, повна сесія — власний файл у корені теки проєкту.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const projectDir =
  arg('dir') || join(homedir(), '.claude', 'projects', `-${process.cwd().replace(/^\//, '').replace(/\//g, '-')}`);
const since = Date.parse(arg('since') || '');
const until = Date.parse(arg('until') || new Date().toISOString());
const lead = arg('lead');
const label = arg('label', 'прогін');

if (Number.isNaN(since)) {
  console.error('Потрібен --since <ISO-час>, напр. --since 2026-08-26T13:00:00Z');
  process.exit(1);
}

function* transcripts(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* transcripts(path);
    else if (entry.name.endsWith('.jsonl')) yield path;
  }
}

const sessions = new Map();
for (const file of transcripts(projectDir)) {
  // Файл, якого не торкались у вікні, читати немає сенсу — їх тут сотні.
  if (statSync(file).mtimeMs < since) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const usage = e?.message?.usage;
    if (e.type !== 'assistant' || !usage) continue;
    const t = Date.parse(e.timestamp || '');
    if (Number.isNaN(t) || t < since || t > until) continue;

    const acc = sessions.get(file) || { msgs: 0, input: 0, cacheCreate: 0, cacheRead: 0, output: 0, session: e.sessionId };
    acc.msgs += 1;
    acc.input += usage.input_tokens || 0;
    acc.cacheCreate += usage.cache_creation_input_tokens || 0;
    acc.cacheRead += usage.cache_read_input_tokens || 0;
    acc.output += usage.output_tokens || 0;
    sessions.set(file, acc);
  }
}

const rows = [...sessions.entries()]
  .map(([file, a]) => ({
    file,
    ...a,
    fresh: a.input + a.cacheCreate,
    name: file.replace(`${projectDir}/`, '').replace(/\.jsonl$/, ''),
    role: file.includes('/subagents/') ? 'субагент' : lead && file.includes(lead) ? 'лід' : 'тіммейт',
  }))
  .sort((x, y) => y.fresh - x.fresh);

const fmt = (n) => n.toLocaleString('uk-UA').replace(/ /g, ' ');
const total = rows.reduce(
  (t, r) => ({
    msgs: t.msgs + r.msgs,
    fresh: t.fresh + r.fresh,
    cacheRead: t.cacheRead + r.cacheRead,
    output: t.output + r.output,
  }),
  { msgs: 0, fresh: 0, cacheRead: 0, output: 0 },
);

console.log(`\n${label}: ${new Date(since).toISOString()} → ${new Date(until).toISOString()}`);
console.log(
  `${'транскрипт'.padEnd(44)} ${'роль'.padEnd(9)} ${'повідомл.'.padStart(9)} ${'свіжі'.padStart(10)} ${'cached'.padStart(12)} ${'output'.padStart(9)}`,
);
for (const r of rows) {
  console.log(
    `${r.name.slice(-44).padEnd(44)} ${r.role.padEnd(9)} ${String(r.msgs).padStart(9)} ${fmt(r.fresh).padStart(10)} ${fmt(r.cacheRead).padStart(12)} ${fmt(r.output).padStart(9)}`,
  );
}
console.log(
  `${'РАЗОМ'.padEnd(54)} ${String(total.msgs).padStart(9)} ${fmt(total.fresh).padStart(10)} ${fmt(total.cacheRead).padStart(12)} ${fmt(total.output).padStart(9)}\n`,
);
