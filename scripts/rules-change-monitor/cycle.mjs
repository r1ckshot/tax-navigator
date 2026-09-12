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
import { screenSource } from "./screen.mjs";
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

/**
 * Запис про сторінку, яку відхилено ще до витягу числа.
 *
 * Стан — `unavailable`, і восьмого стану ми не заводимо: сім значень AC-03 —
 * контракт нарізки (`states.mjs`, `PRD.md:99`), і розширювати його заради
 * одного випадку означало б переписати контракт задля реалізації. По суті це
 * теж `unavailable`: цифру НЕ перевірено. Але «заблоковано» і «впало» вимагають
 * різної реакції людини, тож окремий прапорець `blocked` несе саме цю
 * відмінність, і звіт друкує їх різними розділами.
 */
function blockedCheck(rule, url, failure_reason) {
  return {
    rule_id: rule.rule_id,
    state: STATES.UNAVAILABLE,
    blocked: true,
    matrix_value: null,
    fetched_value: null,
    diff_percent: null,
    failure_reason,
    fetched_from: url,
    source_url: rule.source_url ?? null,
    verified_at: rule.verified_at ?? null,
  };
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

    // Перевірка стоїть МІЖ фетчем і екстрактором, а не після нього: після
    // витягу числа чужий текст уже пройшов через регулярки й міг потрапити в
    // `fetched_value`, тобто в звіт, тобто до моделі.
    const screened = screenSource(html);
    if (screened.blocked) {
      checks.push(blockedCheck(rule, extractor.url, screened.failure_reason));
      continue;
    }

    checks.push(
      compareValues({
        rule_id: rule.rule_id,
        matrix_value,
        fetched_raw: screened.html === null ? null : extractor.extract(screened.html),
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
  const blocked = finalChecks.filter((c) => c.blocked === true).length;
  return {
    month: monthOf(now),
    started_at,
    finished_at: new Date().toISOString(),
    // Три значення, і `blocked` б'є `partial`: недоступне джерело — це погана
    // погода, відхилений вхід — це хтось писав агенту через державну сторінку.
    // Однакове слово на обидва випадки ховало б другий серед першого.
    status: blocked > 0 ? "blocked" : unavailable > 0 ? "partial" : "completed",
    checks: finalChecks,
  };
}

/**
 * Код виходу циклу. «Заблоковано» ≠ «впало», і код мусить це нести: 1 означає,
 * що скрипт зламався (баг, битий JSON) — його ставить `catch` нижче; 2 — що
 * скрипт відпрацював правильно і відхилив вхід. Планувальник реагує на них
 * по-різному, а один код на два випадки змусив би читати лог, щоб зрозуміти,
 * що сталось.
 *
 * Експортується, щоб ворота `evals/` перевіряли ТОЙ САМИЙ мапінг, який
 * виконується в проді, а не його переказ у тесті.
 */
export function exitCodeFor(cycle) {
  return cycle.status === "blocked" ? 2 : 0;
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

  if (cycle.status === "blocked") {
    console.error("цикл відхилив щонайменше одне джерело — дивись розділ «Заблоковані входи»");
  }
  process.exitCode = exitCodeFor(cycle);
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`цикл звірки впав: ${error.message}`);
    process.exit(1);
  });
}
