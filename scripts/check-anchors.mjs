#!/usr/bin/env node
// Перевіряє, що кожен якір `шлях:рядок` у docs/architecture-map.md вказує на
// рядок, який реально існує.
//
// Причина існування: перша версія карти мала ~12 зсунутих якорів. Частина —
// перенесені неточно, частина — зсунулась тому, що ARCHITECTURE.md відредагували
// ПІСЛЯ скану. Обидва випадки виглядають правдоподібно при читанні й ловляться
// лише машинно. Карта з вигаданими рядками гірша за її відсутність — це записано
// в анти-патернах самого скіла.
//
// Друга перевірка — ЗМІСТ рядка, а не лише його існування. 2026-08-04 сім із
// девʼяти якорів у переверстані компоненти вказували не туди (`RiskBadge.tsx:15`
// потрапляв у коментар), а гейт лишався зеленим: номер рядка існував, отже
// «все добре». Тому поряд із картою живе відбиток `docs/architecture-map.anchors.json`
// — текст процитованих рядків на момент останнього оновлення карти. Розійшовся
// текст — падаємо.
//
// Оновлення відбитка — свідома дія: `node scripts/check-anchors.mjs --update`,
// і скрипт друкує, що саме змінилось. Регенерувати НАОСЛІП означає повернути
// той самий зелений гейт без предмета перевірки.
//
// Чого скрипт НЕ вміє й далі: сказати, чи твердження карти правдиве. Він ловить
// зсуви за межу файла, неоднозначні шляхи і мовчазний дрейф рядків — оцінка
// самого твердження лишається на очі рев'юера.

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { globSync } from "node:fs";

const MAP = "docs/architecture-map.md";
const SNAPSHOT = "docs/architecture-map.anchors.json";
const UPDATE = process.argv.includes("--update");
let failed = 0;
const fail = (m) => { console.error(`FAIL: ${m}`); failed++; };
const ok = (m) => console.log(`OK: ${m}`);

if (!existsSync(MAP)) {
  console.log(`SKIP: ${MAP} не існує — карту ще не будували`);
  process.exit(0);
}

const src = readFileSync(MAP, "utf8");

// `шлях.ext:12` або `шлях.ext:12-34` або `шлях.ext:12,34`
const RE = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|json|css|mjs|cjs|md)):(\d+)(?:[-,](\d+))?`/g;

// Файли репо, крім курсу й залежностей — для розв'язання коротких імен.
const all = globSync("**/*.{ts,tsx,json,css,mjs,cjs,md}", {
  exclude: (p) => /node_modules|\.next|docs\/course|\.git/.test(p),
});

const byBasename = new Map();
for (const p of all) {
  const base = p.split("/").pop();
  if (!byBasename.has(base)) byBasename.set(base, []);
  byBasename.get(base).push(p);
}

/** Відбиток рядка: без крайніх пробілів і без подвійних усередині — щоб
 *  переформатування відступів не давало хибних падінь. */
const fingerprint = (line) => line.trim().replace(/\s+/g, " ");

const previous = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, "utf8")) : {};
const current = {};
const drifted = [];

const seen = new Set();
let checked = 0;

for (const m of src.matchAll(RE)) {
  const [, ref, aRaw, bRaw] = m;
  const key = `${ref}:${aRaw}${bRaw ? `-${bRaw}` : ""}`;
  if (seen.has(key)) continue;
  seen.add(key);

  let file = null;
  if (existsSync(ref) && statSync(ref).isFile()) {
    file = ref;
  } else {
    // короткий шлях: шукаємо за суфіксом, вимагаємо однозначності
    const cands = all.filter((p) => p === ref || p.endsWith("/" + ref));
    if (cands.length === 1) file = cands[0];
    else if (cands.length > 1) {
      fail(`${key} — неоднозначний шлях, підходить ${cands.length}: ${cands.slice(0, 3).join(", ")}`);
      continue;
    } else {
      const base = byBasename.get(ref.split("/").pop());
      fail(`${key} — файл не знайдено${base ? ` (є схожі: ${base.slice(0, 3).join(", ")})` : ""}`);
      continue;
    }
  }

  const lines = readFileSync(file, "utf8").split("\n");
  const last = Math.max(+aRaw, bRaw ? +bRaw : 0);
  if (last > lines.length) {
    fail(`${key} — за межею: ${file} має ${lines.length} рядків`);
    continue;
  }
  checked++;

  // Відбиток беремо з першого і (для діапазону) останнього процитованого рядка:
  // зсув коду майже завжди рухає обидва, а зберігати весь блок — зайве.
  const marks = bRaw && +bRaw !== +aRaw ? [+aRaw, +bRaw] : [+aRaw];
  current[key] = marks.map((n) => fingerprint(lines[n - 1] ?? ""));

  const before = previous[key];
  if (!before) {
    if (!UPDATE) fail(`${key} — якоря немає у відбитку; звір рядок очима і зафіксуй: node scripts/check-anchors.mjs --update`);
    else drifted.push(`+ ${key}`);
    continue;
  }
  if (JSON.stringify(before) !== JSON.stringify(current[key])) {
    if (!UPDATE) {
      fail(
        `${key} — рядок змінився з моменту останнього оновлення карти.\n` +
          `      було:  ${before.join(" … ")}\n` +
          `      стало: ${current[key].join(" … ")}`
      );
    } else {
      drifted.push(`~ ${key}`);
    }
  }
}

if (UPDATE) {
  const removed = Object.keys(previous).filter((k) => !(k in current));
  writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Відбиток оновлено: ${Object.keys(current).length} якорів.`);
  for (const line of drifted) console.log(`  ${line}`);
  for (const k of removed) console.log(`  - ${k} (якір прибрано з карти)`);
  console.log("Перечитай список очима: регенерація наосліп знімає сенс перевірки.");
  process.exit(failed ? 1 : 0);
}

if (failed === 0) ok(`якорі карти архітектури: ${checked} перевірено — і межі файлів, і текст рядків`);
process.exit(failed ? 1 : 0);
