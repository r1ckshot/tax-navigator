#!/usr/bin/env node
/**
 * UserPromptSubmit — нагадує (не блокує), якщо є коміти, яких
 * docs/STATE.md ще не бачив. Та сама межа "з останнього разу", що й у
 * scripts/state-checkpoint/ — останній коміт, що чіпав docs/STATE.md.
 *
 * Навмисно НЕ Stop-хук: курсовий stop-quality-gate.sh (5.4 Hooks) сам
 * застерігає в коментарі, що жорсткий Stop-гейт — "anti-pattern для
 * більшості реальних проєктів", бо може заблокувати посеред
 * багатокрокової задачі до фінального коміту. UserPromptSubmit натомість
 * дає additionalContext на кожен новий промпт Mike, без переривання
 * поточної роботи.
 */
import { spawnSync } from "node:child_process";

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return (r.stdout || "").trim();
}

function pluralCommits(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "коміт";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "коміти";
  return "комітів";
}

try {
  const lastStateCommit = git(["log", "-1", "--format=%H", "--", "docs/STATE.md"]);
  if (!lastStateCommit) process.exit(0); // docs/STATE.md поза git-історією — нічого перевіряти

  const commitsSince = git(["log", `${lastStateCommit}..HEAD`, "--oneline"]);
  if (!commitsSince) process.exit(0);

  const count = commitsSince.split("\n").filter(Boolean).length;
  const context =
    `Нагадування DoD: ${count} ${pluralCommits(count)} після останньої правки ` +
    `docs/STATE.md (остання — ${lastStateCommit.slice(0, 7)}). Якщо задача ` +
    `завершується — онови STATE.md перед тим, як сказати "готово" ` +
    `(scripts/state-checkpoint/ може скласти чернетку).`;
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context },
    })
  );
} catch {
  // не падати через git-помилку в незвичному стані репо
}
process.exit(0);
