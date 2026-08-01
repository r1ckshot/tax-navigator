#!/usr/bin/env node
/**
 * PreToolUse + matcher Bash + if: git commit* — гейт перед комітом.
 *
 * Замінює інлайн `npm test` у settings.json. Два чеки, обидва мають ловити
 * проблему ДО коміту, не після: кирилиця в message (правило CLAUDE.md
 * "коміти англійською" один раз протекло в subject — 2026-07-31) і
 * `npm test` + `npm run verify` (той самий клас, що й check-docs.mjs, лишень
 * рівнем раніше).
 */
import { spawnSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = (JSON.parse(raw || '{}').tool_input || {}).command || '';
  } catch {
    process.exit(0);
  }
  if (!command) process.exit(0);

  const CYRILLIC = /[Ѐ-ӿ]/;
  if (CYRILLIC.test(command)) {
    deny('Кирилиця в git commit — коміти строго англійською (CLAUDE.md, розділ Git).');
    return;
  }

  const test = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8' });
  if (test.status !== 0) {
    deny(`npm test впав — коміт заблоковано.\n${tail(test.stdout + test.stderr)}`);
    return;
  }

  const verify = spawnSync('npm', ['run', 'verify', '--silent'], { encoding: 'utf8' });
  if (verify.status !== 0) {
    deny(`npm run verify впав — коміт заблоковано.\n${tail(verify.stdout + verify.stderr)}`);
    return;
  }

  process.exit(0);
});

function tail(s, n = 20) {
  return s.trim().split('\n').slice(-n).join('\n');
}

function deny(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}
