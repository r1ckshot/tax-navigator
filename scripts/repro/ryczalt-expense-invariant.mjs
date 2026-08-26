#!/usr/bin/env node
// Відтворення дефекту «ричалт не віднімає фактичних витрат» — придатне для
// `git bisect run`, тобто для запуску на ЧУЖОМУ checkout-і, де немає ні цього
// файла, ні сьогоднішніх тестів.
//
// Правило уроку 10.5: спершу відтворення, тоді пошук. Тож предикат тут
// названий числом, а не відчуттям, і має чесний вихідний код:
//
//   0   good — двигун віднімає витрати (або ричалту в цьому checkout-і ще немає)
//   1   bad  — «на руки» по ричалту НЕ реагує на витрати
//   125 skip — цей checkout нічого не каже: немає vitest-конфігу, зонд не
//              зібрався, число не порахувалось. Не вгадуємо — віддаємо skip,
//              бо хибне «bad» веде bisect не туди тихо.
//
// Предикат диференційний, а не еталонне число: порівнюємо «на руки» при двох
// смугах витрат (lt10 = 5% і gt30 = 40%) на тій самій виручці. Так перевірка
// переживає будь-яку зміну ставок у rules.2026.json уздовж історії — вона питає
// не «скільки», а «чи взагалі витрати доходять до кишені».
//
// Використання:
//   node scripts/repro/ryczalt-expense-invariant.mjs [--repo <шлях>] [--verbose]
//   node scripts/repro/ryczalt-expense-invariant.mjs --self-test
//
// Для bisect копія кладеться ПОЗА дерево (файл зникне на старих комітах):
//   cp scripts/repro/ryczalt-expense-invariant.mjs /tmp/probe.mjs
//   git bisect start <bad> <good>
//   git bisect run node /tmp/probe.mjs --repo /workspace

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GOOD = 0;
export const BAD = 1;
export const SKIP = 125;

/** Виручка зонда. Будь-яка стала підійде — важлива різниця, не рівень. */
const MONTHLY_REVENUE = 15000;
/** Допуск у злотих: більше за грош, менше за будь-яку реальну зміну ставки. */
const TOLERANCE = 1;

/**
 * Вердикт за двома вимірами зонда. Винесено окремо від запуску vitest, щоб
 * --self-test перевіряв саме логіку рішення, а не середовище.
 */
export function verdict({ lt10, gt30, expectedDelta }) {
  if (![lt10, gt30, expectedDelta].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return { code: SKIP, reason: "зонд не повернув чисел — цей checkout нічого не каже" };
  }
  if (expectedDelta <= 0) {
    return { code: SKIP, reason: "смуги витрат у цьому checkout-і не відрізняються — предикат неперевірний" };
  }
  const delta = lt10 - gt30;
  if (Math.abs(delta - expectedDelta) <= TOLERANCE) {
    return {
      code: GOOD,
      reason: `витрати доходять до кишені: різниця ${delta.toFixed(2)} zł при очікуваних ${expectedDelta.toFixed(2)}`,
    };
  }
  if (Math.abs(delta) <= TOLERANCE) {
    return {
      code: BAD,
      reason: `«на руки» не реагує на витрати: різниця ${delta.toFixed(2)} zł при очікуваних ${expectedDelta.toFixed(2)}`,
    };
  }
  return {
    code: SKIP,
    reason: `третя поведінка (різниця ${delta.toFixed(2)} zł при очікуваних ${expectedDelta.toFixed(2)}) — не вгадуємо`,
  };
}

/**
 * Зонд, що виконується вже в чужому checkout-і. Свідомо не імпортує ні
 * fixtures, ні benchmark-тестів: вони змінюються вздовж історії, а публічний
 * інтерфейс `calcJdg(answers)` — ні. Ставки витрат бере з самого коду
 * (`expenseRate`), тому очікувана різниця рахується там же, де й вимір.
 */
function probeSource(outPath) {
  return `import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { calcJdg } from '../scenarios/jdg';
import { expenseRate } from '../scenarios/shared';

const base = {
  daysInPl: 'gte183',
  personalCenter: 'PL',
  economicCenter: 'PL',
  specialLaw52zr: 'no',
  incomeSource: 'plClients',
  permanentHomeInUa: false,
  hasActiveUaFop: false,
  monthlyRevenue: ${MONTHLY_REVENUE},
  workKind: 'programming',
  expenseShare: 'lt10',
  hasParallelUop: false,
  formerEmployer: 'no',
  jdgStatus: 'gt30',
  hadJdgInLast60Months: false,
  voluntarySickness: true,
};

function takeHome(share) {
  const result = calcJdg({ ...base, expenseShare: share });
  const ryczalt = (result.subforms ?? []).find((s) => s.id === 'ryczalt');
  const range = ryczalt && ryczalt.rangeMonthly;
  return range ? (range.min + range.max) / 2 : null;
}

it('bisect probe: ричалт проти смуги витрат', () => {
  const payload = {
    lt10: takeHome('lt10'),
    gt30: takeHome('gt30'),
    expectedDelta: ${MONTHLY_REVENUE} * (expenseRate('gt30') - expenseRate('lt10')),
  };
  writeFileSync(${JSON.stringify(outPath)}, JSON.stringify(payload));
});
`;
}

function run(repo, verbose) {
  const engine = join(repo, "app/lib/calc/scenarios/jdg.ts");
  if (!existsSync(engine)) {
    // Дефекту немає, бо немає й самого числа: показати неправильний «на руки»
    // нічим. Це свідома половина предиката, не обхід.
    return { code: GOOD, reason: "у цьому checkout-і немає app/lib/calc/scenarios/jdg.ts — ричалт не рахується взагалі" };
  }
  if (!existsSync(join(repo, "vitest.config.ts"))) {
    return { code: SKIP, reason: "немає vitest.config.ts — TS-модулі нічим виконати" };
  }

  const testsDir = join(repo, "app/lib/calc/__tests__");
  mkdirSync(testsDir, { recursive: true });
  const probePath = join(testsDir, "bisect-probe.test.ts");
  const outDir = mkdtempSync(join(tmpdir(), "ryczalt-probe-"));
  const outPath = join(outDir, "probe.json");

  try {
    writeFileSync(probePath, probeSource(outPath));
    const proc = spawnSync("npx", ["vitest", "run", "bisect-probe", "--reporter=dot"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
    });
    if (verbose) {
      process.stderr.write(proc.stdout ?? "");
      process.stderr.write(proc.stderr ?? "");
    }
    if (!existsSync(outPath)) {
      const tail = ((proc.stderr ?? "") + (proc.stdout ?? "")).trim().split("\n").slice(-3).join(" | ");
      return { code: SKIP, reason: `зонд не виконався (${tail || "без виводу"})` };
    }
    return verdict(JSON.parse(readFileSync(outPath, "utf8")));
  } finally {
    // Прибирати обов'язково: файл untracked, тож `git checkout` наступного
    // кроку bisect його не зніме, і він поїде далі по історії разом з нами.
    rmSync(probePath, { force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}

/**
 * Червоно-зелений self-test самого предиката: три входи, три різні вердикти.
 * Без нього «скрипт із чесним exit-кодом» лишався б обіцянкою.
 */
function selfTest() {
  const cases = [
    { name: "витрати віднімаються → good", input: { lt10: 10000, gt30: 4750, expectedDelta: 5250 }, expect: GOOD },
    { name: "витрати ігноруються → bad", input: { lt10: 10492.49, gt30: 10492.49, expectedDelta: 5250 }, expect: BAD },
    { name: "часткове віднімання → skip", input: { lt10: 10000, gt30: 8000, expectedDelta: 5250 }, expect: SKIP },
    { name: "зонд без чисел → skip", input: { lt10: null, gt30: null, expectedDelta: 5250 }, expect: SKIP },
  ];
  let failed = 0;
  for (const c of cases) {
    const got = verdict(c.input).code;
    const ok = got === c.expect;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${c.name} (очікували ${c.expect}, отримали ${got})`);
  }
  console.log(failed === 0 ? `${cases.length}/${cases.length} зелені` : `${failed} провалено`);
  return failed === 0 ? 0 : 1;
}

// CLI лише при прямому запуску: файл імпортується тестом
// (`ryczalt-expense-invariant.test.mjs`), і без цієї межі імпорт сам підняв би
// vitest усередині vitest.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    process.exit(selfTest());
  }
  const repoIndex = args.indexOf("--repo");
  const repo = repoIndex >= 0 ? args[repoIndex + 1] : process.cwd();
  const { code, reason } = run(repo, args.includes("--verbose"));
  const label = { [GOOD]: "GOOD", [BAD]: "BAD", [SKIP]: "SKIP" }[code];
  console.log(`${label} (${code}): ${reason}`);
  process.exit(code);
}
