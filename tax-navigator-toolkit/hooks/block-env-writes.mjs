#!/usr/bin/env node
/**
 * PreToolUse + matcher Bash → блокує запис у `.env*` через шелл.
 *
 * Навіщо окремий хук, якщо в `settings.json` уже є `deny` на `Write(.env)`:
 * permission-деню дивиться на `tool_input.file_path` і не бачить нічого, коли
 * файл створює сам шелл. `echo SECRET > .env` проходив повз нього — діра
 * записана в `.claude/rules/environment-limits.md` як свідомо не закрита.
 *
 * PostToolUse тут безсилий за визначенням: на момент його виклику секрет уже
 * на диску, і хук може лише поскаржитись. Запобігти може тільки PreToolUse.
 *
 * `.env.example` (і будь-що на `.example` / `.sample` / `.template`) лишається
 * дозволеним — він у git, на нього спирається onboarding, і саме на ньому
 * ламається наївний патерн `*.env.*` із курсового рецепта.
 */

/** Шлях-ціль виду `.env`, `.env.local`, `config/.env.production`. */
const TARGET = String.raw`(?:[^\s;&|<>"'` + "`" + String.raw`]*\/)?\.env(?:\.[A-Za-z0-9_-]+)*`;

/** Кожен патерн — операція запису + ціль у групі 1. */
const WRITE_PATTERNS = [
  { what: 'редирект', re: new RegExp(String.raw`>>?\s*(${TARGET})(?![\w.-])`) },
  { what: 'tee', re: new RegExp(String.raw`\btee\b[^;&|]*?\s(${TARGET})(?![\w.-])`) },
  { what: 'копіювання', re: new RegExp(String.raw`\b(?:cp|mv|install|rsync)\b[^;&|]*\s(${TARGET})(?![\w.-])`) },
  { what: 'sed -i', re: new RegExp(String.raw`\bsed\b[^;&|]*\s-i\b[^;&|]*\s(${TARGET})(?![\w.-])`) },
  { what: 'truncate/dd', re: new RegExp(String.raw`\b(?:truncate|dd)\b[^;&|]*?(${TARGET})(?![\w.-])`) },
];

const IS_TEMPLATE = /\.(example|sample|template|dist)$/;

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let command = '';
  try {
    // Порожній або битий payload — не наша справа: хук не має падати й не має
    // блокувати те, чого не зрозумів.
    command = (JSON.parse(raw || '{}').tool_input || {}).command || '';
  } catch {
    process.exit(0);
  }
  if (!command) process.exit(0);

  for (const { what, re } of WRITE_PATTERNS) {
    const m = command.match(re);
    if (!m) continue;
    const target = m[1];
    if (IS_TEMPLATE.test(target)) continue;

    process.stderr.write(
      `ЗАБЛОКОВАНО: запис у ${target} через шелл (${what}).\n` +
        `.env-файли не редагуються ні агентом, ні шеллом — тільки людиною вручну.\n` +
        `Якщо треба показати змінну — додай її в .env.example без значення.\n`,
    );
    process.exit(2);
  }

  process.exit(0);
});
