#!/usr/bin/env node
// Машинна звірка документів — три перевірки з docs/STATE.md ("Наступне", п.1):
//   1. кількість тестів, заявлена прозою в STATE.md, == фактична (vitest)
//   2. NOW у BACKLOG.md не дублює те, що STATE.md вже записав як закрите
//   3. відносні markdown-посилання між git-трекнутими .md файлами не биті
//
// Причина існування: "правило без машинної перевірки протікає" (DECISIONS
// 2026-07-29) — STATE одного разу писав «86 тестів», коли їх було 89, і ніхто
// цього не помітив, бо перевіряти доводилось на очі.

import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";

let failed = 0;
const ok = (msg) => console.log(`OK: ${msg}`);
const fail = (msg) => { console.error(`FAIL: ${msg}`); failed++; };

const STATE = "docs/STATE.md";
const BACKLOG = "docs/BACKLOG.md";

// ---- 1. Кількість тестів у STATE.md == фактична -------------------------

function runVitest(configArgs) {
  const dir = mkdtempSync(join(tmpdir(), "check-docs-"));
  const outFile = join(dir, "report.json");
  const r = spawnSync(
    "npx",
    ["vitest", "run", ...configArgs, "--reporter=json", `--outputFile=${outFile}`],
    { encoding: "utf8" }
  );
  if (!existsSync(outFile)) {
    rmSync(dir, { recursive: true, force: true });
    return { error: `vitest не написав звіт (код ${r.status}): ${(r.stderr || r.stdout || "").trim().split("\n").pop()}` };
  }
  const report = JSON.parse(readFileSync(outFile, "utf8"));
  rmSync(dir, { recursive: true, force: true });
  return { passed: report.numPassedTests, failed: report.numFailedTests };
}

{
  const stateSrc = readFileSync(STATE, "utf8");
  const m = stateSrc.match(/(\d+)\s*node-тест\S*\s*\+\s*(\d+)\s*UI/);
  if (!m) {
    fail(`${STATE} не містить фрази "N node-тести + M UI" — формат змінився, оновити регулярку скрипта`);
  } else {
    const statedNode = +m[1];
    const statedUi = +m[2];
    const node = runVitest([]);
    const ui = runVitest(["--config", "vitest.ui.config.ts"]);
    if (node.error) fail(`node-тести: ${node.error}`);
    if (ui.error) fail(`UI-тести: ${ui.error}`);
    if (!node.error && !ui.error) {
      if (node.failed > 0) fail(`node-тести: ${node.failed} падає — STATE.md каже "зелені"`);
      if (ui.failed > 0) fail(`UI-тести: ${ui.failed} падає — STATE.md каже "зелені"`);
      if (node.passed !== statedNode) fail(`STATE.md каже ${statedNode} node-тестів, фактично ${node.passed}`);
      if (ui.passed !== statedUi) fail(`STATE.md каже ${statedUi} UI-тестів, фактично ${ui.passed}`);
      if (node.passed === statedNode && ui.passed === statedUi && node.failed === 0 && ui.failed === 0) {
        ok(`кількість тестів у STATE.md збігається з фактичною: ${statedNode} node + ${statedUi} UI`);
      }
    }
  }
}

// ---- 2. NOW у BACKLOG.md не дублює закрите в STATE.md --------------------

function extractBacktickTokens(text) {
  return new Set([...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
}

{
  const stateSrc = readFileSync(STATE, "utf8");
  // Блок закритих задач: рядок "Зроблено ..." або "Закрито ..." (без "- "),
  // далі підряд рядки "- [x] ..." до першого порожнього рядка.
  const lines = stateSrc.split("\n");
  const closedTokens = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (/^(Зроблено|Закрито)\s/.test(lines[i])) {
      for (let j = i + 1; j < lines.length && /^- \[x\]/.test(lines[j]); j++) {
        for (const t of extractBacktickTokens(lines[j])) closedTokens.add(t);
      }
    }
  }

  const backlogSrc = readFileSync(BACKLOG, "utf8");
  const nowSection = backlogSrc.split(/\n## /).find((s) => s.startsWith("NOW")) ?? "";
  const nowTokens = extractBacktickTokens(nowSection);

  const stale = [...nowTokens].filter((t) => closedTokens.has(t));
  if (stale.length) {
    for (const t of stale) fail(`BACKLOG.md NOW згадує \`${t}\`, а STATE.md уже записав це як закрите — приберіть рядок із NOW`);
  } else {
    ok(`NOW у BACKLOG.md не дублює закрите в STATE.md (${closedTokens.size} закритих токенів звірено)`);
  }
}

// ---- 3. Відносні markdown-посилання між .md не биті ----------------------

{
  const r = spawnSync("git", ["ls-files", "*.md"], { encoding: "utf8" });
  const files = r.stdout.trim().split("\n").filter(Boolean);
  const LINK_RE = /\[[^\]]*\]\(([^)#]+)(#[^)]*)?\)/g;
  let checked = 0;
  let broken = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // Приклади синтаксису всередині inline-коду (напр. `[<назва>](<url>)` як
    // шаблон у документації команди) — не справжні посилання. Індекси/рядки
    // лишаються коректними: заміна тієї самої довжини.
    const stripped = src.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
    for (const m of stripped.matchAll(LINK_RE)) {
      const target = m[1];
      if (/^([a-z]+:)?\/\//.test(target) || target.startsWith("mailto:")) continue; // зовнішнє посилання
      const resolved = resolve(dirname(file), target);
      checked++;
      if (!existsSync(resolved)) {
        const line = src.slice(0, m.index).split("\n").length;
        fail(`${file}:${line} — посилання на "${target}" не існує (${resolved.replace(process.cwd() + "/", "")})`);
        broken++;
      }
    }
  }
  if (broken === 0) ok(`перехресні посилання: ${checked} перевірено в ${files.length} файлах, усі живі`);
}

console.log("");
if (failed) {
  console.error("=== check-docs: ПРОВАЛЕНО ===");
  process.exit(1);
} else {
  console.log("=== check-docs: ОК ===");
  process.exit(0);
}
