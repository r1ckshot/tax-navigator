#!/usr/bin/env node
// Бот-PR «re-verify»: нова `verified_at` правилам, що збіглись із першоджерелом,
// і охорона, яка не пускає в такий PR нічого, крім цих дат.
//
// Дві команди, бо їх виконують різні кроки workflow і різні чекаути:
//   node reverify.mjs apply --cycle <cycle.json> [--rules <rules.json>] [--checked <rules.json>] --date YYYY-MM-DD
//   node reverify.mjs guard --base <rules.json> --head <rules.json> --today YYYY-MM-DD
//
// `apply` правит текст файла, а не перезаписує JSON: форматування матриці
// (порожні рядки між групами правил) лишається, і дифф PR — рівно рядки дат.
// `guard` не довіряє `apply`: він порівнює дві версії файла сам, і саме він, а
// не `apply`, стоїть між ботом і `git push` (DECISIONS 2026-10-01: `params` бот не
// змінює ніколи).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyOutcome } from "./outcome.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RULES = resolve(HERE, "../../app/lib/rules/rules.2026.json");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Нова дата правилам `ids` у тексті матриці. Дата лише рухається вперед: старіша
 * за наявну чи та сама — без змін (повторний прогін того ж дня нічого не пише).
 *
 * @returns {{ text: string, bumped: string[] }}
 */
export function bumpVerifiedAt(text, ids, date) {
  if (!ISO_DATE.test(date)) throw new Error(`дата не YYYY-MM-DD: ${date}`);
  let out = text;
  const bumped = [];
  for (const id of ids) {
    // Від `"rule_id": "<id>"` до першої `verified_at` без іншого `rule_id` між ними.
    const re = new RegExp(`("rule_id":\\s*"${escapeRe(id)}"(?:(?!"rule_id")[\\s\\S])*?"verified_at":\\s*")(\\d{4}-\\d{2}-\\d{2})(")`);
    const m = out.match(re);
    if (!m) throw new Error(`правило ${id}: verified_at у матриці не знайдено`);
    if (m[2] >= date) continue;
    out = out.replace(re, `$1${date}$3`);
    bumped.push(id);
  }
  return { text: out, bumped };
}

function withoutDates(rule) {
  const { verified_at, ...rest } = rule;
  return rest;
}

/** Стабільний JSON: порядок ключів не має робити однакові правила різними. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Що змінилось між двома версіями матриці, крім дозволеного. Порожній масив —
 * PR можна пушити. Дозволено одне: `verified_at` правила рухається вперед, не
 * далі за сьогодні. Все інше — `params`, `source_url`, нове чи зникле правило,
 * інший порядок, поле поза `rules` — порушення.
 *
 * @returns {string[]}
 */
export function guardRulesChange(baseText, headText, { today }) {
  if (!ISO_DATE.test(today)) throw new Error(`дата не YYYY-MM-DD: ${today}`);
  const base = JSON.parse(baseText);
  const head = JSON.parse(headText);
  const problems = [];

  const { rules: baseRules, ...baseTop } = base;
  const { rules: headRules, ...headTop } = head;
  if (canonical(baseTop) !== canonical(headTop)) problems.push("змінились поля матриці поза rules");
  if (!Array.isArray(baseRules) || !Array.isArray(headRules)) return [...problems, "rules — не масив"];

  const baseIds = baseRules.map((r) => r.rule_id);
  const headIds = headRules.map((r) => r.rule_id);
  if (canonical(baseIds) !== canonical(headIds)) {
    problems.push(`набір або порядок правил змінився: [${baseIds}] → [${headIds}]`);
    return problems;
  }

  baseRules.forEach((b, i) => {
    const h = headRules[i];
    if (canonical(withoutDates(b)) !== canonical(withoutDates(h))) {
      problems.push(`${b.rule_id}: змінено щось, крім verified_at`);
    }
    if (b.verified_at !== h.verified_at) {
      if (!ISO_DATE.test(String(h.verified_at))) problems.push(`${b.rule_id}: verified_at не дата: ${h.verified_at}`);
      else if (h.verified_at < b.verified_at) problems.push(`${b.rule_id}: verified_at рухається назад (${b.verified_at} → ${h.verified_at})`);
      else if (h.verified_at > today) problems.push(`${b.rule_id}: verified_at у майбутньому (${h.verified_at})`);
    }
  });
  return problems;
}

/**
 * Правила, чиї дані в матриці, яку звіряв цикл (`checked`), і в матриці, куди
 * йде PR (`target`), однакові без дат. Цикл гілки звіряє її матрицю, а бот-PR
 * іде на master: якщо числа правила там інші, збіг доводить не їх, і нова дата
 * підтвердила б неперевірене.
 */
export function sameRuleData(checkedText, targetText, ids) {
  const index = (text) => new Map(JSON.parse(text).rules.map((r) => [r.rule_id, canonical(withoutDates(r))]));
  const checked = index(checkedText);
  const target = index(targetText);
  return ids.filter((id) => checked.has(id) && checked.get(id) === target.get(id));
}

function arg(args, name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "apply") {
    const cycle = JSON.parse(readFileSync(arg(args, "cycle"), "utf8"));
    const rulesPath = arg(args, "rules") ?? DEFAULT_RULES;
    const date = arg(args, "date");
    const { reverify } = classifyOutcome(cycle);
    const target = readFileSync(rulesPath, "utf8");
    const checkedPath = arg(args, "checked");
    const eligible = checkedPath ? sameRuleData(readFileSync(checkedPath, "utf8"), target, reverify) : reverify;
    for (const id of reverify.filter((x) => !eligible.includes(x))) console.error(`apply: ${id} пропущено — дані правила в звіреній і цільовій матриці різні`);
    const { text, bumped } = bumpVerifiedAt(target, eligible, date);
    writeFileSync(rulesPath, text, "utf8");
    // Один id на рядок: workflow читає список як є, без парсингу прози.
    for (const id of bumped) console.log(id);
    return;
  }
  if (command === "guard") {
    const problems = guardRulesChange(readFileSync(arg(args, "base"), "utf8"), readFileSync(arg(args, "head"), "utf8"), {
      today: arg(args, "today"),
    });
    if (problems.length > 0) {
      for (const p of problems) console.error(`guard: ${p}`);
      process.exitCode = 1;
      return;
    }
    console.log("guard: змінились лише verified_at, вперед і не далі за сьогодні");
    return;
  }
  console.error("usage: reverify.mjs apply --cycle <file> [--rules <file>] --date YYYY-MM-DD | guard --base <file> --head <file> --today YYYY-MM-DD");
  process.exitCode = 2;
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`reverify впав: ${error.message}`);
    process.exit(1);
  }
}
