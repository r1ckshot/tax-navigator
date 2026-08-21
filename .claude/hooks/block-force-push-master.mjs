#!/usr/bin/env node
/**
 * PreToolUse + matcher Bash + if: Bash(git push *) — блокує БУДЬ-ЯКИЙ push у
 * master: force, звичайний і видалення гілки. Адаптація курсового
 * recipe-5-git-policy.sh (5.4 Hooks, slide 4, приклад if-поля): Node замість
 * bash+python3 для консистентності з рештою .claude/hooks/*, і токен-парсинг
 * замість одного regex — щоб ловити прапорці незалежно від їх позиції в
 * команді (git push origin --force master, не лише git push --force ...) і
 * "гілку не назвали явно" (git push / git push origin — ціль тоді поточна
 * гілка, а не рядок "master" у команді).
 *
 * Ім'я файла лишилось від першої версії (лише force). Не перейменовуємо: шлях
 * прописаний у .claude/settings.json, а той редагує тільки Mike вручну
 * (environment-limits.md) — розхід між іменем і поведінкою дешевший за
 * хук, що мовчки зник із конвеєра.
 *
 * Два різні приводи, одна відмова:
 *   force  — DECISIONS 2026-07-29: дозволений ЛИШЕ для лінеаризації власної
 *            історії з явним підтвердженням Mike; хук чату не бачить, тож
 *            блокує завжди.
 *   plain  — CLAUDE.md §Git: у master не пушимо напряму, тільки merge PR.
 *            Це середній із трьох шарів (урок 9.3): звичка → цей хук →
 *            branch protection на GitHub. Перший шар пропускає описку, третій
 *            ловить будь-кого, але вже після round-trip до GitHub.
 */
import { spawnSync } from "node:child_process";

const PROTECTED_BRANCHES = ["master", "main"];
const FORCE_FLAGS = new Set(["-f", "--force", "--force-with-lease", "--force-if-includes"]);
const DELETE_FLAGS = new Set(["-d", "--delete"]);
// Прапорці, значення яких стоїть ОКРЕМИМ токеном: інакше `git push -o ci.skip
// origin master` прочитає "ci.skip" як refspec.
const FLAGS_WITH_VALUE = new Set(["-o", "--push-option", "--receive-pack", "--exec", "--repo"]);
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
  const force = rest.some(isForceFlag);
  const deleting = rest.some((t) => DELETE_FLAGS.has(t));
  // Push самих тегів (`git push --tags`, `git push origin --tags`) гілки не
  // чіпає взагалі — інакше реліз (9.7) з master виглядав би як push у master.
  const tagsOnly = rest.some((t) => t === "--tags");

  const nonFlags = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t.startsWith("-")) {
      if (FLAGS_WITH_VALUE.has(t)) i++;
      continue;
    }
    nonFlags.push(t);
  }

  for (const t of nonFlags) {
    const dst = t.includes(":") ? t.split(":").pop() : t;
    const name = dst.replace(/^refs\/heads\//, "");
    if (PROTECTED_BRANCHES.includes(name)) return { branch: name, force, deleting };
  }

  // Ані refspec, ані назви гілки в команді нема (`git push`, `git push origin`,
  // `git push --force`) — ціль визначає git сам: поточна гілка.
  if (nonFlags.length <= 1 && !tagsOnly) {
    const current = currentBranch();
    if (PROTECTED_BRANCHES.includes(current)) return { branch: current, force, deleting };
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
    const hit = checkPart(part);
    if (!hit) continue;

    const { branch, force, deleting } = hit;
    if (deleting) {
      console.error(`BLOCKED: видалення захищеної гілки "${branch}" (block-force-push-master.mjs).`);
    } else if (force) {
      console.error(`BLOCKED: force-push у захищену гілку "${branch}" (block-force-push-master.mjs).`);
      console.error(
        "CLAUDE.md: без force-push до master. Виняток (лінеаризація власної історії, DECISIONS 2026-07-29) — лише вручну поза Claude Code, з підтвердженням Mike."
      );
    } else {
      console.error(`BLOCKED: прямий push у захищену гілку "${branch}" (block-force-push-master.mjs).`);
      console.error(
        `CLAUDE.md §Git: у ${branch} потрапляє тільки злитий PR. Пушити в названу гілку: git push -u origin <type>/<slug>, далі gh pr create --draft.`
      );
    }
    process.exit(2);
  }
  process.exit(0);
});
