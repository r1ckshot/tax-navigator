#!/usr/bin/env node
// Ворота пропозиції агента `investigate` (rules-verify.yml). Без моделі: агент
// пише нотатки й, можливо, правку; що з цього стане чернеткою PR, вирішує код.
//
// Запускається двічі: у job агента — з копії, знятої ДО агента (агент не може
// переписати перевірку, яка його судить), і в `open-draft` — з чекауту до
// `git apply` (патч не встигає підмінити ворота).
//
//   git diff --name-only | node gate.mjs --notes notes.md --package-base a.json --package-head b.json
//
// Друкує `proposal=true|false` і причини; код виходу 1 — порушення (агент зачепив
// те, чого не можна, або не відпрацював зовсім). Тиша без пропозиції — 0.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Куди агентові можна писати: правило, доказ, тест розрахунку, версія. */
export const ALLOWED = Object.freeze([
  /^app\/lib\/rules\/rules\.2026\.json$/,
  /^docs\/EVIDENCE\.md$/,
  /^app\/lib\/calc\/__tests__\/[\w.-]+\.test\.ts$/,
  /^package\.json$/,
  /^CHANGELOG\.md$/,
]);

/** У `package.json` агент може змінити лише `version` (patch, коли змінилось видиме число). */
export function packageProblems(baseText, headText) {
  const base = JSON.parse(baseText);
  const head = JSON.parse(headText);
  const strip = ({ version, ...rest }) => JSON.stringify(rest);
  return strip(base) === strip(head) ? [] : ["package.json: змінено щось, крім version"];
}

/**
 * @returns {{ verdict: "proposal"|"none"|"rejected", reasons: string[] }}
 */
export function judgeProposal({ changed, notes, packageBase = null, packageHead = null }) {
  const reasons = [];
  // Немає нотаток — агент не відпрацював. Це червоний прогін, не тиша
  // (DECISIONS 2026-09-15: про прогін судимо за артефактом).
  if (!notes || notes.trim().length < 40) return { verdict: "rejected", reasons: ["notes.md порожній або відсутній — агент не відпрацював"] };

  const files = [...new Set(changed.map((f) => f.trim()).filter(Boolean))];
  const outside = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
  if (outside.length > 0) reasons.push(`файли поза дозволеними: ${outside.join(", ")}`);
  if (files.includes("package.json")) {
    if (packageBase === null || packageHead === null) reasons.push("package.json змінено, а версій для порівняння не дано");
    else reasons.push(...packageProblems(packageBase, packageHead));
  }
  // evidence-numbers: зміна правила без рядка доказу — мовчазна правка.
  if (files.includes("app/lib/rules/rules.2026.json") && !files.includes("docs/EVIDENCE.md")) {
    reasons.push("rules.2026.json змінено без рядка в docs/EVIDENCE.md");
  }
  if (reasons.length > 0) return { verdict: "rejected", reasons };
  if (files.length === 0) return { verdict: "none", reasons: ["агент не запропонував правки — лише нотатки"] };
  return { verdict: "proposal", reasons: [`файли: ${files.join(", ")}`] };
}

function arg(args, name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
}
const readIf = (path) => (path && existsSync(path) ? readFileSync(path, "utf8") : null);

function main() {
  const args = process.argv.slice(2);
  const changed = readFileSync(0, "utf8").split("\n");
  const { verdict, reasons } = judgeProposal({
    changed,
    notes: readIf(arg(args, "notes")),
    packageBase: readIf(arg(args, "package-base")),
    packageHead: readIf(arg(args, "package-head")),
  });
  for (const r of reasons) console.log(`# ${r}`);
  console.log(`verdict=${verdict}`);
  console.log(`proposal=${verdict === "proposal"}`);
  if (verdict === "rejected") process.exitCode = 1;
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
