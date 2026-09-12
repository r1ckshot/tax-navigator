#!/usr/bin/env node
// Драйвер пари входів для `check_injection.py`: проганяє справжній `runCycle`
// на збереженій сторінці замість мережі й друкує те, що побачила б людина —
// звіт, статус циклу і код виходу.
//
// Чому окремий драйвер, а не прапорець у `cycle.mjs`: тестовий вхід не має
// права існувати в бойовій точці входу. Прапорець «візьми сторінку з файла»
// у продакшн-скрипті — це рівно той канал, яким підсовують підроблене джерело.
//
// Чому НЕ переказує логіку `cycle.mjs`: і `runCycle`, і `renderReport`, і
// мапінг коду виходу `exitCodeFor` імпортовані, не скопійовані. Драйвер, який
// повторює поведінку своїми словами, доводить лише те, що він сам собі не
// суперечить.
//
// Використання:
//   node evals/injection_pair.mjs malicious   # має дати exit 2
//   node evals/injection_pair.mjs benign      # має дати exit 0

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runCycle, exitCodeFor } from "../scripts/rules-change-monitor/cycle.mjs";
import { renderReport, summaryLine } from "../scripts/rules-change-monitor/report.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(REPO, "scripts/rules-change-monitor/__fixtures__");

const CASES = {
  // Збережена сторінка zus.pl із прихованим зверненням до агента.
  malicious: "zus-skladki-poisoned.html",
  // Та сама сторінка зі зміненою ставкою і без жодної інструкції (контроль).
  benign: "zus-skladki-raised.html",
};

const name = process.argv[2];
if (!Object.hasOwn(CASES, name)) {
  console.error(`очікував один із: ${Object.keys(CASES).join(", ")}`);
  process.exit(1);
}

// Правило зафіксоване ТУТ, а не взяте з `rules.2026.json`, і це виправлення
// реального дефекту воріт. З живою матрицею ворота ламались двічі:
//   1. прийнята розбіжність оновлює `common.minimum_wage` до 4950 — безпечний
//      вхід дає `match` замість `divergence`, «4950» зі звіту зникає, і
//      блокуючий job падає з «перевірка блокує все підряд»;
//   2. перейменування правила кладе рядок `rules.2026.json` у stderr драйвера,
//      і перевірка на витік рапортує про просочену отруєну сторінку, якої не було.
// Предмет цих воріт — перевірка входу, не свіжість матриці. Ту стереже
// `check-stale-rules.mjs`.
const rule = {
  rule_id: "common.minimum_wage",
  params: { monthly: 4806 },
  source_url: "https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki/skladki",
  verified_at: "2026-07-18",
};

const html = readFileSync(join(FIXTURES, CASES[name]), "utf8");

const cycle = await runCycle({
  rules: [rule],
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => html }),
});

console.log(renderReport(cycle));
console.log(summaryLine(cycle));
console.log(`status=${cycle.status}`);
process.exit(exitCodeFor(cycle));
