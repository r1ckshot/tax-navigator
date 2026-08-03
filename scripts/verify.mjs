#!/usr/bin/env node
// Крос-платформна заміна python3/bash-перевірок starter-Makefile (Windows-хост без make/python3).
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

let failed = false;
const ok = (msg) => console.log(`OK: ${msg}`);
const fail = (msg) => { console.error(`FAIL: ${msg}`); failed = true; };
const skip = (msg) => console.log(`SKIP: ${msg}`);

function readJSON(relPath) {
  return JSON.parse(readFileSync(relPath, "utf8"));
}

// 1. JSON-валідність core-конфігів
for (const f of [".claude/settings.json", ".claude/settings.local.json.example"]) {
  if (!existsSync(f)) { fail(`${f} відсутній`); continue; }
  try {
    readJSON(f);
    ok(`${f} валідний JSON`);
  } catch (e) {
    fail(`${f} невалідний JSON: ${e.message}`);
  }
}

let settings;
try {
  settings = readJSON(".claude/settings.json");
} catch (e) {
  console.error(`FAIL: не можу прочитати .claude/settings.json: ${e.message}`);
  process.exit(1);
}

// 2. Обов'язковий deny-мінімум (секрети + незворотні команди)
const deny = settings.permissions?.deny ?? [];
const requiredDeny = [
  "Read(**/.env)",
  "Read(**/*.pem)",
  "Read(**/*.key)",
  "Bash(rm -rf *)",
  "Bash(sudo *)",
];
for (const pattern of requiredDeny) {
  deny.includes(pattern)
    ? ok(`deny містить ${pattern}`)
    : fail(`deny НЕ містить обов'язковий патерн ${pattern}`);
}

// 3. Sandbox увімкнений
settings.sandbox?.enabled === true
  ? ok("sandbox.enabled = true")
  : fail("sandbox.enabled не true");

// 4. Консистентність доменів: settings.json ↔ init-firewall.sh (з'явиться на Кроці 6)
const firewallPath = ".devcontainer/init-firewall.sh";
if (!existsSync(firewallPath)) {
  skip("devcontainer/init-firewall.sh ще не існує — перевірку доменів пропущено");
} else {
  const fw = readFileSync(firewallPath, "utf8");
  // Закриваюча дужка МУСИТЬ матчитись на початку рядка: non-greedy `\)` обривався
  // на першій дужці всередині коментаря, і перевірка мовчки переставала бачити
  // домени, дописані нижче. Зелений гейт без предмета перевірки — гірше за червоний.
  const match = fw.match(/ALLOWED_DOMAINS=\(([\s\S]*?)^\)/m);
  if (!match) {
    fail("не знайдено ALLOWED_DOMAINS у init-firewall.sh");
  } else {
    const fwDomains = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const settingsDomains = settings.sandbox?.network?.allowedDomains ?? [];
    const missingInFw = settingsDomains.filter((d) => !fwDomains.includes(d));
    const missingInSettings = fwDomains.filter((d) => !settingsDomains.includes(d));
    if (missingInFw.length === 0 && missingInSettings.length === 0) {
      ok("домени settings.json ↔ init-firewall.sh збігаються");
    } else {
      if (missingInFw.length) fail(`є в settings.json, немає у init-firewall.sh: ${missingInFw.join(", ")}`);
      if (missingInSettings.length) fail(`є в init-firewall.sh, немає у settings.json: ${missingInSettings.join(", ")}`);
    }
  }
}

// 5. devcontainer.json runArgs (з'явиться на Кроці 6)
const devcontainerPath = ".devcontainer/devcontainer.json";
if (!existsSync(devcontainerPath)) {
  skip("devcontainer/devcontainer.json ще не існує — перевірку runArgs пропущено");
} else {
  try {
    const dc = readJSON(devcontainerPath);
    const runArgs = dc.runArgs ?? [];
    const hasNetAdmin = runArgs.some((a) => a.includes("NET_ADMIN"));
    const hasNetRaw = runArgs.some((a) => a.includes("NET_RAW"));
    hasNetAdmin && hasNetRaw
      ? ok("devcontainer.json runArgs містить NET_ADMIN і NET_RAW")
      : fail("devcontainer.json runArgs не містить NET_ADMIN/NET_RAW — iptables не запуститься");
  } catch (e) {
    fail(`devcontainer.json невалідний JSON: ${e.message}`);
  }
}

// 6. Якорі карти архітектури — окремий скрипт, бо він потрібен і сам по собі
//    (скіл map-architecture ганяє його перед комітом карти).
{
  const r = spawnSync(process.execPath, ["scripts/check-anchors.mjs"], { encoding: "utf8" });
  // FAIL друкується у stderr, OK — у stdout. Читати лише stdout означало б
  // проґавити всі провали й лишити гейт зеленим без предмета перевірки.
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const fails = out.split("\n").filter((l) => l.startsWith("FAIL:"));
  if (r.status === 0 && fails.length === 0) {
    ok((r.stdout || "").trim().split("\n").pop().replace(/^OK: /, ""));
  } else if (fails.length) {
    for (const l of fails) fail(l.replace(/^FAIL: /, ""));
  } else {
    fail(`check-anchors.mjs впав із кодом ${r.status}: ${out.trim().split("\n").pop()}`);
  }
}

// 7. Звірка документів: кількість тестів у STATE.md, NOW у BACKLOG.md проти
//    закритого в STATE.md, живі перехресні markdown-посилання — окремий
//    скрипт, бо ганяє vitest сам і корисний і поза verify.
{
  const r = spawnSync(process.execPath, ["scripts/check-docs.mjs"], { encoding: "utf8" });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const fails = out.split("\n").filter((l) => l.startsWith("FAIL:"));
  if (r.status === 0 && fails.length === 0) {
    for (const l of out.split("\n").filter((l) => l.startsWith("OK:"))) ok(l.replace(/^OK: /, ""));
  } else if (fails.length) {
    for (const l of fails) fail(l.replace(/^FAIL: /, ""));
  } else {
    fail(`check-docs.mjs впав із кодом ${r.status}: ${out.trim().split("\n").pop()}`);
  }
}

// 8. Плагін — не форк, а копія: `.claude/` і `tax-navigator-toolkit/` мусять
//    нести той самий код хуків і той самий текст команд та скілів. Копії вже
//    існували й нічим не трималися; розходження помічається лише тоді, коли
//    встановлений плагін поводиться інакше за репо — тобто пізно й дорого.
{
  const twins = [
    [".claude/hooks/block-env-writes.mjs", "tax-navigator-toolkit/hooks/block-env-writes.mjs"],
    [".claude/hooks/pre-commit-gate.mjs", "tax-navigator-toolkit/hooks/pre-commit-gate.mjs"],
    [".claude/hooks/layer-boundary.mjs", "tax-navigator-toolkit/hooks/layer-boundary.mjs"],
    [".claude/hooks/test-block-env-writes.sh", "tax-navigator-toolkit/hooks/test-block-env-writes.sh"],
    [".claude/hooks/test-pre-commit-gate.sh", "tax-navigator-toolkit/hooks/test-pre-commit-gate.sh"],
    [".claude/hooks/test-layer-boundary.sh", "tax-navigator-toolkit/hooks/test-layer-boundary.sh"],
    [".claude/commands/scaffold-rule.md", "tax-navigator-toolkit/commands/scaffold-rule.md"],
    [".claude/commands/scaffold-scenario.md", "tax-navigator-toolkit/commands/scaffold-scenario.md"],
    [".claude/skills/add-source-domain/SKILL.md", "tax-navigator-toolkit/skills/add-source-domain/SKILL.md"],
    [".claude/skills/scenario-tests/SKILL.md", "tax-navigator-toolkit/skills/scenario-tests/SKILL.md"],
    [".claude/skills/feature-ship/SKILL.md", "tax-navigator-toolkit/skills/feature-ship/SKILL.md"],
  ];

  let drifted = 0;
  for (const [source, copy] of twins) {
    if (!existsSync(source) || !existsSync(copy)) {
      fail(`плагін: немає пари ${source} ↔ ${copy}`);
      drifted++;
      continue;
    }
    if (readFileSync(source, "utf8") !== readFileSync(copy, "utf8")) {
      fail(`плагін: ${copy} розійшовся з ${source}`);
      drifted++;
    }
  }
  if (drifted === 0) ok(`плагін синхронний із .claude/: ${twins.length} пар звірено`);
}

console.log("");
if (failed) {
  console.error("=== Verify: ПРОВАЛЕНО ===");
  process.exit(1);
} else {
  console.log("=== Verify: ОК ===");
  process.exit(0);
}
