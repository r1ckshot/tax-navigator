#!/usr/bin/env node
// Точка входу місячного циклу звірки: allowlist → фетч → нормалізація → diff →
// стан → звіт. Модулі роблять по одному кроку, тут лише порядок і те, що
// кожне правило матриці мусить вийти звідси рівно з одним станом (AC-03).
//
// Використання:
//   node scripts/rules-change-monitor/cycle.mjs            # живий прогін
//   node scripts/rules-change-monitor/cycle.mjs --dry-run  # без мережі й без запису
//
// Помилка тут — `throw` + `process.exit(1)` на верхньому рівні, як у
// `scripts/fetch-zus-benchmark.mjs` (`sad.md` §8), а не тихий exit 0.

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyScope } from "./allowlist.mjs";
import { compareValues } from "./diff.mjs";
import { EXTRACTORS, fetchSource, noExtractorCheck } from "./sources.mjs";
import { renderReport, summaryLine } from "./report.mjs";
import { appendCycle, readHistory, writeHistory } from "./state.mjs";
import { STATES, isState } from "./states.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_HISTORY_PATH = join(HERE, "data", "cycle-history.json");
const RULES_PATH = resolve(HERE, "../../app/lib/rules/rules.2026.json");

/** `YYYY-MM` того дня, коли цикл запущено. Місяць — ключ унікальності циклу. */
export function monthOf(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Повний `RuleCheck` зі стану класифікації: у звіт має їхати запис, не стан. */
function scopeCheck(rule, { state, failure_reason }) {
  return {
    rule_id: rule.rule_id,
    state,
    matrix_value: null,
    fetched_value: null,
    diff_percent: null,
    failure_reason,
    fetched_from: null,
    source_url: rule.source_url ?? null,
    verified_at: rule.verified_at ?? null,
  };
}

/**
 * Один прогін звірки над переданими правилами. Мережа інжектується, тому цикл
 * тестується цілком без неї — і саме тому тест бачить порядок кроків, а не
 * лише окремі модулі.
 */
export async function runCycle({
  rules,
  now = new Date(),
  fetchImpl,
  extractors = EXTRACTORS,
  // Два діагностичні гачки — тільки для тестів гейта. Без них інваріант
  // неможливо перевірити інакше як тавтологією: сам `runCycle` кидає раніше,
  // ніж хтось побачить поганий запис.
  mutate = null,
  drop = false,
} = {}) {
  const started_at = now.toISOString();
  const checks = [];

  for (const rule of rules) {
    const scope = classifyScope(rule);
    if (scope) {
      checks.push(scopeCheck(rule, scope));
      continue;
    }

    const extractor = extractors[rule.rule_id];
    if (!extractor) {
      checks.push(noExtractorCheck(rule));
      continue;
    }

    const matrix_value = extractor.matrixValue(rule.params);
    const { html, failure_reason } = await fetchSource(extractor.url, { fetchImpl });
    checks.push(
      compareValues({
        rule_id: rule.rule_id,
        matrix_value,
        fetched_raw: html === null ? null : extractor.extract(html),
        // Сторінка, з якої реально взято число. У матриці `source_url` часто
        // інший (людське посилання на роз'яснення), і друкувати число під ним
        // означало б атрибутувати його джерелу, якого скрипт не читав.
        fetched_from: extractor.url,
        source_url: rule.source_url ?? null,
        verified_at: rule.verified_at ?? null,
        failure_reason,
      })
    );
  }

  const finalChecks = drop ? checks.slice(0, -1) : mutate ? checks.map(mutate) : checks;

  // Інваріант AC-03 перевіряється тут, а не в звіті: звіт, який мовчки пропустив
  // запис без стану, виглядав би як «усе гаразд».
  const broken = finalChecks.filter((c) => !isState(c.state));
  if (broken.length > 0) {
    throw new Error(`записи без валідного стану: ${broken.map((c) => c.rule_id).join(", ")}`);
  }
  if (finalChecks.length !== rules.length) {
    throw new Error(`перевірено ${finalChecks.length} записів із ${rules.length} — жоден не має зникнути`);
  }

  const unavailable = finalChecks.filter((c) => c.state === STATES.UNAVAILABLE).length;
  return {
    month: monthOf(now),
    started_at,
    finished_at: new Date().toISOString(),
    // partial, коли хоч одне джерело не відповіло: цикл відбувся, але картина
    // неповна, і це має бути видно в історії, а не лише в тілі звіту.
    status: unavailable > 0 ? "partial" : "completed",
    checks: finalChecks,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const { rules } = JSON.parse(readFileSync(RULES_PATH, "utf8"));

  const cycle = await runCycle({
    rules,
    fetchImpl: dryRun
      ? async () => {
          throw new Error("--dry-run: мережа свідомо вимкнена");
        }
      : undefined,
  });

  console.log(renderReport(cycle));
  console.log(summaryLine(cycle));

  if (dryRun) {
    console.log("--dry-run: історія не записана");
    return;
  }
  const history = readHistory(DEFAULT_HISTORY_PATH);
  writeHistory(DEFAULT_HISTORY_PATH, appendCycle(history, cycle));
  console.log(`історія оновлена: ${DEFAULT_HISTORY_PATH}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`цикл звірки впав: ${error.message}`);
    process.exit(1);
  });
}
