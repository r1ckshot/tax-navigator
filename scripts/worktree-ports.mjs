#!/usr/bin/env node
/**
 * Порти, розведені по worktree.
 *
 * У репо два процеси, що слухають порт: `next dev` (3000) і вебхук
 * evidence-guard (8790). Два worktree, піднятих одночасно, зіткнулись би на
 * обох. Пам'ятати про `-p` щоразу — ненадійно, тому порт виводиться з самого
 * worktree, а `npm run dev` іде через цей скрипт.
 *
 * Головний worktree дістає offset 0, тобто рівно базові порти — поведінка
 * основної теки не змінюється. Кожен linked worktree дістає offset 1..49,
 * виведений з абсолютного шляху.
 *
 * Використання:
 *   node scripts/worktree-ports.mjs                 показати розкладку
 *   node scripts/worktree-ports.mjs --json          те саме машинно
 *   node scripts/worktree-ports.mjs --get PORT      одне число, для Makefile
 *   node scripts/worktree-ports.mjs -- next dev     запустити з цими портами
 */

import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Базові порти = те, що процеси беруть без нашого втручання. */
export const BASE_PORTS = Object.freeze({
  PORT: 3000,
  EVIDENCE_GUARD_PORT: 8790,
});

/**
 * 49 слотів, а не 100: діапазони 3001-3049 і 8791-8839 не перетинаються між
 * собою й лишають простір під інші сервіси.
 */
export const MAX_OFFSET = 49;

/** FNV-1a, 32 біти. Потрібна лише детермінованість, не криптостійкість. */
export function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Розкладає offset-и по worktree-шляхах.
 *
 * Перший шлях у списку — головний worktree, він завжди дістає 0. Решта беруть
 * `1 + hash % MAX_OFFSET`; при збігу двох хешів наступний вільний слот
 * підбирається лінійною пробою в порядку відсортованих шляхів, тож результат
 * однаковий у будь-якому worktree того самого репо.
 *
 * @param {string[]} paths абсолютні шляхи, головний worktree першим
 * @returns {Map<string, number>}
 */
export function assignOffsets(paths) {
  const [main, ...linked] = paths;
  const offsets = new Map([[main, 0]]);
  const taken = new Set([0]);

  if (linked.length >= MAX_OFFSET) {
    throw new Error(
      `Забагато worktree: ${linked.length} при ${MAX_OFFSET} слотах портів. ` +
        'Приберіть зайві (`git worktree remove`) або підніміть MAX_OFFSET.',
    );
  }

  for (const path of [...linked].sort()) {
    let offset = 1 + (fnv1a(path) % MAX_OFFSET);
    while (taken.has(offset)) {
      offset = (offset % MAX_OFFSET) + 1;
    }
    taken.add(offset);
    offsets.set(path, offset);
  }

  return offsets;
}

/** Порти для одного offset-а. */
export function portsForOffset(offset) {
  return Object.fromEntries(
    Object.entries(BASE_PORTS).map(([name, base]) => [name, base + offset]),
  );
}

/** `git worktree list --porcelain` → абсолютні шляхи, головний першим. */
export function parseWorktreeList(porcelain) {
  return porcelain
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => resolve(line.slice('worktree '.length).trim()));
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Поточний worktree, його offset і порти. */
export function describeCurrent(cwd = process.cwd()) {
  const current = resolve(git(['rev-parse', '--show-toplevel'], cwd));
  const paths = parseWorktreeList(git(['worktree', 'list', '--porcelain'], cwd));
  const offsets = assignOffsets(paths);
  const offset = offsets.get(current) ?? 0;

  return {
    worktree: current,
    isMain: paths[0] === current,
    offset,
    ports: portsForOffset(offset),
  };
}

function render(info) {
  const label = info.isMain ? 'головний worktree' : `linked worktree, offset ${info.offset}`;
  const rows = Object.entries(info.ports)
    .map(([name, port]) => `  ${name.padEnd(20)} ${port}`)
    .join('\n');
  return `${info.worktree}\n  (${label})\n${rows}`;
}

function main(argv) {
  const separator = argv.indexOf('--');
  const flags = separator === -1 ? argv : argv.slice(0, separator);
  const command = separator === -1 ? [] : argv.slice(separator + 1);
  const info = describeCurrent();

  const getIndex = flags.indexOf('--get');
  if (getIndex !== -1) {
    const name = flags[getIndex + 1];
    if (!(name in info.ports)) {
      console.error(`Невідомий порт: ${name}. Відомі: ${Object.keys(info.ports).join(', ')}`);
      process.exit(1);
    }
    console.log(info.ports[name]);
    return;
  }

  if (command.length === 0) {
    console.log(flags.includes('--json') ? JSON.stringify(info, null, 2) : render(info));
    return;
  }

  const [bin, ...args] = command;
  console.error(render(info));
  const child = spawn(bin, args, {
    stdio: 'inherit',
    env: { ...process.env, ...Object.fromEntries(Object.entries(info.ports).map(([k, v]) => [k, String(v)])) },
  });
  child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : (code ?? 0));
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2));
}
