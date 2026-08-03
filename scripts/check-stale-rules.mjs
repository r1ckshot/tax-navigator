#!/usr/bin/env node
// Обчислює, які правила в rules.2026.json довше за поріг не звірялись із
// джерелом. Спільна логіка для SessionStart-хука
// (.claude/hooks/session-stale-rules.mjs) — щоб "що вважати застарілим"
// не розійшлось у двох місцях (BACKLOG, 5.4 Hooks третій).
//
// Це nudge, не verify-гейт: стара цифра не обов'язково хибна, просто варта
// повторної звірки перед сезоном (evidence-numbers.md цього не вимагає
// автоматично — рішення лишається за людиною).
//
// Запуск напряму: node scripts/check-stale-rules.mjs [--days=90]

import { readFileSync } from "node:fs";

const RULES_FILE = "app/lib/rules/rules.2026.json";

export function getStaleRules(thresholdDays = 90, now = new Date()) {
  const data = JSON.parse(readFileSync(RULES_FILE, "utf8"));
  const stale = [];
  for (const rule of data.rules) {
    const verifiedAt = new Date(`${rule.verified_at}T00:00:00Z`);
    const ageDays = Math.floor((now - verifiedAt) / (1000 * 60 * 60 * 24));
    if (ageDays > thresholdDays) {
      stale.push({
        rule_id: rule.rule_id,
        verified_at: rule.verified_at,
        ageDays,
        source_url: rule.source_url,
      });
    }
  }
  return stale.sort((a, b) => b.ageDays - a.ageDays);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const threshold = daysArg ? Number(daysArg.split("=")[1]) : 90;
  const stale = getStaleRules(threshold);
  if (stale.length === 0) {
    console.log(`OK: жодне правило не старіше за ${threshold} днів без переверки`);
  } else {
    console.log(`Протерміновано (>${threshold} днів без переверки): ${stale.length}`);
    for (const r of stale) {
      console.log(`  ${r.rule_id} — verified_at ${r.verified_at} (${r.ageDays} днів тому) — ${r.source_url}`);
    }
  }
  process.exit(0);
}
