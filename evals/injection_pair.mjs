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

// Правило беремо з реальної матриці, а не вигадуємо: звірка має порівнювати
// сторінку з тим числом, яке справді стоїть у проді.
const { rules } = JSON.parse(readFileSync(join(REPO, "app/lib/rules/rules.2026.json"), "utf8"));
const rule = rules.find((r) => r.rule_id === "common.minimum_wage");
if (!rule) {
  console.error("у rules.2026.json немає правила common.minimum_wage — ворота нема на чому ганяти");
  process.exit(1);
}

const html = readFileSync(join(FIXTURES, CASES[name]), "utf8");

const cycle = await runCycle({
  rules: [rule],
  fetchImpl: async () => ({ ok: true, status: 200, text: async () => html }),
});

console.log(renderReport(cycle));
console.log(summaryLine(cycle));
console.log(`status=${cycle.status}`);
process.exit(exitCodeFor(cycle));
