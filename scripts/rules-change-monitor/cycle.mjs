#!/usr/bin/env node
// Точка входу місячного циклу звірки: allowlist → фетч → нормалізація → diff →
// veto → стан → звіт. Модулі роблять по одному кроку, тут лише порядок і те, що
// кожне правило матриці мусить вийти звідси рівно з одним станом (AC-03).
//
// Використання:
//   node scripts/rules-change-monitor/cycle.mjs            # живий прогін
//   node scripts/rules-change-monitor/cycle.mjs --dry-run  # без мережі й без запису
//
// Живий прогін лишає два артефакти: запис в `data/cycle-history.json` і
// markdown-звіт `data/reports/YYYY-MM.md` — той самий текст, що в stdout.
//
// Помилка тут — `throw` + `process.exit(1)` на верхньому рівні, як у
// `scripts/fetch-zus-benchmark.mjs` (`sad.md` §8), а не тихий exit 0.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyScope, domainOf, notVerifiedScope } from "./allowlist.mjs";
import { pageText } from "./extract.mjs";
import { aggregateFields, checkField } from "./fields.mjs";
import { DERIVED, IMPLEMENTED, VERIFICATION } from "./methods.mjs";
import { PAGES } from "./pages.mjs";
import { screenSource, MAX_INPUT_CHARS } from "./screen.mjs";
import { fetchSource } from "./sources.mjs";
import { renderReport, summaryLine } from "./report.mjs";
import { appendCycle, readHistory, writeHistory } from "./state.mjs";
import { STATES, isState } from "./states.mjs";
import { applyVeto, readVetoRegistry } from "./veto.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_HISTORY_PATH = join(HERE, "data", "cycle-history.json");
export const DEFAULT_REPORTS_DIR = join(HERE, "data", "reports");
export const VETO_REGISTRY_PATH = join(HERE, "veto-registry.json");
const RULES_PATH = resolve(HERE, "../../app/lib/rules/rules.2026.json");

/**
 * Пауза між двома запитами до одного домену (`sad.md` §4 стовп 2, QG-4).
 * Фіксована, без адаптивного backoff — так вирішено в SAD. Опублікованого
 * ліміту ні zus.pl, ні podatki.gov.pl не мають, тож число не з джерела, а з
 * бюджету: навіть 26 правил матриці на одному домені дають менше хвилини
 * пауз, а QG-3 дозволяє циклу 15 хвилин.
 */
export const SAME_DOMAIN_PAUSE_MS = 2_000;

/**
 * Пам'ять одного циклу: коли закінчився останній запит до кожного домену.
 * Відлік від КІНЦЯ запиту, не від початку: повільна відповідь — якраз ознака
 * навантаженого сервера, і вона не має з'їдати паузу.
 */
function createPacer({ pauseMs, sleep, clock }) {
  const lastDone = new Map();
  return {
    async wait(url) {
      const prev = lastDone.get(domainOf(url));
      if (prev === undefined) return;
      const remaining = pauseMs - (clock() - prev);
      if (remaining > 0) await sleep(remaining);
    },
    done(url) {
      lastDone.set(domainOf(url), clock());
    },
  };
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * Правило, чий спосіб звірки цикл ще не виконує (`act`, `edition`, `llm` —
 * сесія 03) або не має. `out_of_scope`, а не `unavailable`: джерело не падало,
 * цикл просто не звіряє це правило цим способом, і причина це називає.
 */
function methodCheck(rule, method) {
  return scopeCheck(rule, {
    state: STATES.OUT_OF_SCOPE,
    failure_reason: method
      ? `спосіб звірки «${method}» цикл ще не виконує`
      : "у реєстрі methods.mjs немає способу звірки для цього правила",
  });
}

/**
 * Один прогін звірки над переданими правилами. Мережа інжектується, тому цикл
 * тестується цілком без неї — і саме тому тест бачить порядок кроків, а не
 * лише окремі модулі.
 *
 * Сторінка тягнеться раз на цикл, скільки б правил із неї не читали: zus.pl
 * обслуговує вісім правил, і вісім однакових запитів поспіль — це та сама
 * поведінка бота, від якої стоїть пауза між запитами.
 */
export async function runCycle({
  rules,
  now = new Date(),
  fetchImpl,
  methods = VERIFICATION,
  pages = PAGES,
  // Порожній дефолт — лише для тестів і `evals/`, яким veto не предмет.
  // Живий прогін (`main`) читає реєстр сам і падає, якщо файла немає.
  vetoes = [],
  pauseMs = SAME_DOMAIN_PAUSE_MS,
  sleep = realSleep,
  clock = Date.now,
  // Два діагностичні гачки — тільки для тестів гейта. Без них інваріант
  // неможливо перевірити інакше як тавтологією: сам `runCycle` кидає раніше,
  // ніж хтось побачить поганий запис.
  mutate = null,
  drop = false,
} = {}) {
  const started_at = now.toISOString();
  const checks = [];
  const pacer = createPacer({ pauseMs, sleep, clock });
  const loaded = new Map();

  async function load(url) {
    if (!loaded.has(url)) {
      await pacer.wait(url);
      const { html, failure_reason } = await fetchSource(url, { fetchImpl });
      pacer.done(url);
      // Перевірка стоїть МІЖ фетчем і витягом, а не після нього: після витягу
      // числа чужий текст уже пройшов через регулярки й міг потрапити в
      // `fetched_value`, тобто в звіт, тобто до моделі.
      const screened = screenSource(html);
      loaded.set(url, {
        failure_reason,
        blocked: screened.blocked ? screened.failure_reason : null,
        truncated: screened.truncated,
        text: screened.html === null ? null : pageText(screened.html),
      });
    }
    return loaded.get(url);
  }

  for (const rule of rules) {
    const notVerified = notVerifiedScope(rule);
    if (notVerified) {
      checks.push(scopeCheck(rule, notVerified));
      continue;
    }

    const method = methods[rule.rule_id]?.method;
    const page = pages[rule.rule_id];
    if (!IMPLEMENTED.includes(method) || !page) {
      checks.push(methodCheck(rule, method));
      continue;
    }

    const fields = Object.entries(page.fields).map(([param, field]) => ({ param, field, url: field.url ?? page.url }));
    // AC-02 перевіряється по сторінці, яку цикл реально відкриє, а не по
    // `source_url`: посилання для людини може вести куди завгодно, а запит іде
    // лише на хост зі SCRIPTABLE_HOSTS.
    const closed = fields.map((f) => classifyScope(rule, f.url)).find(Boolean);
    if (closed) {
      checks.push(scopeCheck(rule, closed));
      continue;
    }

    const results = [];
    let blocked = null;
    let failed = null;
    for (const { param, field, url } of fields) {
      const source = await load(url);
      if (source.blocked) {
        blocked = { url, reason: source.blocked };
        break;
      }
      // Сторінка не відповіла — причина спільна для всіх її полів, і розкладка
      // по полях лише повторила б її N разів.
      if (source.failure_reason) {
        failed = { url, reason: source.failure_reason };
        break;
      }
      const check = checkField({ rule, param, field, url, text: source.text, failure_reason: null, vetoes });
      // Обрізаний вхід не має губитись. Зріз може відсікти маркер, і тоді поле
      // виходить `unavailable` з причиною, яка читається як «джерело мовчало».
      if (source.truncated && check.state === STATES.UNAVAILABLE) {
        check.failure_reason = `${check.failure_reason} (сторінку обрізано за стелею ${MAX_INPUT_CHARS} символів)`;
      }
      results.push(check);
    }
    if (blocked) checks.push(blockedCheck(rule, blocked.url, blocked.reason));
    else if (failed) checks.push({ ...scopeCheck(rule, { state: STATES.UNAVAILABLE, failure_reason: failed.reason }), fetched_from: failed.url });
    else {
      // Листи, яких сторінка не підтверджує і які чекають іншого способу. Без
      // них «збігається» на правилі з однією звіреною цифрою з трьох читалось
      // би як підтвердження всього правила.
      const elsewhere = Object.entries(page.elsewhere ?? {});
      const pending = elsewhere.filter(([, e]) => e.method !== DERIVED).map(([param]) => param);
      // Похідні листи теж називаються: сторінка їх не підтвердила, і мовчання
      // про них читалось би як підтвердження (рев'ю звіту 2026-10).
      const derived = elsewhere.filter(([, e]) => e.method === DERIVED).map(([param]) => param);
      checks.push({
        ...aggregateFields(rule, results),
        ...(pending.length ? { pending } : {}),
        ...(derived.length ? { derived } : {}),
      });
    }
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
 * Пише звіт місяця файлом. Атомарно, як історія (`state.mjs`): повторний
 * прогін того самого місяця заміщає звіт, і обірваний запис не лишає половини.
 *
 * @returns {string} шлях до записаного файла
 */
export function writeReport(dir, cycle) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${cycle.month}.md`);
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, `${renderReport(cycle)}\n${summaryLine(cycle)}\n`, "utf8");
  renameSync(tmpPath, path);
  return path;
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
  const vetoes = readVetoRegistry(VETO_REGISTRY_PATH);

  const cycle = await runCycle({
    rules,
    vetoes,
    fetchImpl: dryRun
      ? async () => {
          throw new Error("--dry-run: мережа свідомо вимкнена");
        }
      : undefined,
  });

  console.log(renderReport(cycle));
  console.log(summaryLine(cycle));

  if (dryRun) {
    console.log("--dry-run: історія і звіт не записані");
    return;
  }
  const history = readHistory(DEFAULT_HISTORY_PATH);
  writeHistory(DEFAULT_HISTORY_PATH, appendCycle(history, cycle));
  console.log(`історія оновлена: ${DEFAULT_HISTORY_PATH}`);
  console.log(`звіт записано: ${writeReport(DEFAULT_REPORTS_DIR, cycle)}`);

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
