#!/usr/bin/env node
/**
 * SessionStart — нагадує про правила, які довше за 90 днів не звірялись
 * із джерелом. Не блокує (nudge, не verify-гейт): стара цифра не
 * обов'язково хибна, просто варта повторної звірки. Логіка обчислення —
 * scripts/check-stale-rules.mjs (спільна, щоб поріг не розійшовся у двох
 * місцях — BACKLOG, 5.4 Hooks третій).
 *
 * STALE_RULES_TEST_NOW — лише для test-session-stale-rules.sh, підміняє
 * "сьогодні" на фіксовану дату, щоб тест не залежав від реального часу.
 */
import { getStaleRules } from "../../scripts/check-stale-rules.mjs";

try {
  const now = process.env.STALE_RULES_TEST_NOW
    ? new Date(process.env.STALE_RULES_TEST_NOW)
    : new Date();
  const stale = getStaleRules(90, now);
  if (stale.length > 0) {
    const lines = stale.map(
      (r) => `- \`${r.rule_id}\` — verified_at ${r.verified_at} (${r.ageDays} днів тому)`
    );
    const context =
      `Протерміновані правила (>90 днів без переверки джерела):\n${lines.join("\n")}\n\n` +
      `Звірити через /scaffold-rule <rule_id> або вручну оновити verified_at і EVIDENCE.md.`;
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
      })
    );
  }
} catch {
  // SessionStart не має падати через відсутній чи биний rules.2026.json
}
process.exit(0);
