#!/usr/bin/env node
// Крос-платформна заміна python3/bash-перевірок starter-Makefile (Windows-хост без make/python3).
import { existsSync, readFileSync } from "node:fs";

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
  const match = fw.match(/ALLOWED_DOMAINS=\(([\s\S]*?)\)/);
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

console.log("");
if (failed) {
  console.error("=== Verify: ПРОВАЛЕНО ===");
  process.exit(1);
} else {
  console.log("=== Verify: ОК ===");
  process.exit(0);
}
