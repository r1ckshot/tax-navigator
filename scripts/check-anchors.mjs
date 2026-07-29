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
// Чого скрипт НЕ вміє: перевірити, що на рядку саме те, що заявлено. Він ловить
// зсуви за межу файла і неоднозначні шляхи — решта лишається на очі рев'юера.

import { existsSync, readFileSync, statSync } from "node:fs";
import { globSync } from "node:fs";

const MAP = "docs/architecture-map.md";
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

  const lineCount = readFileSync(file, "utf8").split("\n").length;
  const last = Math.max(+aRaw, bRaw ? +bRaw : 0);
  if (last > lineCount) {
    fail(`${key} — за межею: ${file} має ${lineCount} рядків`);
    continue;
  }
  checked++;
}

if (failed === 0) ok(`якорі карти архітектури: ${checked} перевірено, усі в межах файлів`);
process.exit(failed ? 1 : 0);
