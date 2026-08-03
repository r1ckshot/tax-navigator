#!/usr/bin/env node
/**
 * PreToolUse + matcher Bash + if: Bash(git push *) — блокує force-push у
 * master. Адаптація курсового recipe-5-git-policy.sh (5.4 Hooks, slide 4,
 * приклад if-поля): Node замість bash+python3 для консистентності з рештою
 * .claude/hooks/*, і токен-парсинг замість одного regex — щоб ловити
 * force-флаг незалежно від його позиції в команді (git push origin
 * --force master, не лише git push --force ...) і "гілку не назвали
 * явно" (git push --force / git push --force origin — ціль тоді поточна
 * гілка, а не рядок "master" у команді).
 *
 * DECISIONS 2026-07-29: force-push до master дозволений ЛИШЕ для
 * лінеаризації власної історії з явним підтвердженням Mike — цей хук
 * того не знає (не бачить чат), тож блокує завжди. Легітимний виняток —
 * Mike запускає команду вручну поза Claude Code.
 */
import { spawnSync } from "node:child_process";

const PROTECTED_BRANCHES = ["master"];
const FORCE_FLAGS = new Set(["-f", "--force", "--force-with-lease", "--force-if-includes"]);
const isForceFlag = (t) => FORCE_FLAGS.has(t) || t.startsWith("--force-with-lease=");

function currentBranch() {
  const r = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  return (r.stdout || "").trim();
}

function checkPart(cmd) {
  const tokens = cmd.trim().split(/\s+/).filter(Boolean);
  const pushIdx = tokens.findIndex((t, i) => t === "git" && tokens[i + 1] === "push");
  if (pushIdx === -1) return null;

  const rest = tokens.slice(pushIdx + 2);
  if (!rest.some(isForceFlag)) return null;

  const nonFlags = rest.filter((t) => !t.startsWith("-"));

  for (const t of nonFlags) {
    const dst = t.includes(":") ? t.split(":").pop() : t;
    const name = dst.replace(/^refs\/heads\//, "");
    if (PROTECTED_BRANCHES.includes(name)) return name;
  }

  // Ані refspec, ані назви гілки в команді нема (`git push --force` або
  // `git push --force origin`) — ціль визначає git сам: поточна гілка.
  if (nonFlags.length <= 1) {
    const current = currentBranch();
    if (PROTECTED_BRANCHES.includes(current)) return current;
  }

  return null;
}

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = (JSON.parse(raw || "{}").tool_input || {}).command || "";
  } catch {
    process.exit(0);
  }
  if (!command) process.exit(0);

  for (const part of command.split(/&&|;|\|\|/)) {
    const branch = checkPart(part);
    if (branch) {
      console.error(
        `BLOCKED: force-push у захищену гілку "${branch}" заборонено (block-force-push-master.mjs).`
      );
      console.error(
        "CLAUDE.md: без force-push до master. Виняток (лінеаризація власної історії, DECISIONS 2026-07-29) — лише вручну поза Claude Code, з підтвердженням Mike."
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
