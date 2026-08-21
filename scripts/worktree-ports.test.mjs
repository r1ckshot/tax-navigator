import { describe, expect, it } from 'vitest';

import {
  BASE_PORTS,
  MAX_OFFSET,
  assignOffsets,
  fnv1a,
  parseWorktreeList,
  portsForOffset,
} from './worktree-ports.mjs';

const MAIN = '/workspace';
const A = '/workspace/.claude/worktrees/feature-a';
const B = '/workspace/.claude/worktrees/feature-b';

describe('offset-и по worktree', () => {
  it('головний worktree лишається на базових портах', () => {
    const offsets = assignOffsets([MAIN, A, B]);

    expect(offsets.get(MAIN)).toBe(0);
    expect(portsForOffset(0)).toEqual({ PORT: 3000, EVIDENCE_GUARD_PORT: 8790 });
  });

  it('linked worktree ніколи не дістає offset головного', () => {
    const offsets = assignOffsets([MAIN, A, B]);

    expect(offsets.get(A)).toBeGreaterThan(0);
    expect(offsets.get(B)).toBeGreaterThan(0);
  });

  it('два worktree дістають різні порти на обох сервісах', () => {
    const offsets = assignOffsets([MAIN, A, B]);
    const portsA = portsForOffset(offsets.get(A));
    const portsB = portsForOffset(offsets.get(B));

    expect(portsA.PORT).not.toBe(portsB.PORT);
    expect(portsA.EVIDENCE_GUARD_PORT).not.toBe(portsB.EVIDENCE_GUARD_PORT);
  });

  it('діапазони next і evidence-guard не перетинаються навіть на краю', () => {
    const highest = portsForOffset(MAX_OFFSET);

    expect(highest.PORT).toBe(3049);
    expect(highest.EVIDENCE_GUARD_PORT).toBe(8839);
    expect(highest.PORT).toBeLessThan(BASE_PORTS.EVIDENCE_GUARD_PORT);
  });

  it('порядок аргументів не впливає на результат', () => {
    const forward = assignOffsets([MAIN, A, B]);
    const reversed = assignOffsets([MAIN, B, A]);

    expect(reversed.get(A)).toBe(forward.get(A));
    expect(reversed.get(B)).toBe(forward.get(B));
  });

  it('збіг хешів розводиться, а не віддає однаковий порт', () => {
    // Шукаємо реальну пару шляхів з однаковим `hash % MAX_OFFSET` — так тест
    // б'є в саму пробу, а не в припущення про неї.
    const paths = Array.from({ length: 400 }, (_, i) => `/workspace/.claude/worktrees/wt-${i}`);
    const slot = (p) => 1 + (fnv1a(p) % MAX_OFFSET);
    const first = paths.find((p, i) => paths.slice(0, i).some((q) => slot(q) === slot(p)));
    const second = paths.find((q) => q !== first && slot(q) === slot(first));

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const offsets = assignOffsets([MAIN, first, second]);
    expect(offsets.get(first)).not.toBe(offsets.get(second));
  });

  it('більше worktree, ніж слотів, падає гучно', () => {
    const many = Array.from({ length: MAX_OFFSET + 1 }, (_, i) => `/wt/${i}`);

    expect(() => assignOffsets([MAIN, ...many])).toThrow(/Забагато worktree/);
  });
});

describe('fnv1a', () => {
  it('детермінований і в межах 32 біт', () => {
    expect(fnv1a(A)).toBe(fnv1a(A));
    expect(fnv1a(A)).toBeGreaterThanOrEqual(0);
    expect(fnv1a(A)).toBeLessThanOrEqual(0xffffffff);
  });

  it('еталон із специфікації FNV-1a 32-bit', () => {
    // "a" = 0xe40c292c, "foobar" = 0xbf9cf968 — контрольні вектори FNV-1a,
    // не з нашого ж виводу. Плутанина з FNV-1 ("a" = 0x050c5d1e) ловиться тут:
    // алгоритми відрізняються порядком xor і множення.
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
});

describe('parseWorktreeList', () => {
  it('бере лише рядки worktree і зберігає порядок', () => {
    const porcelain = [
      'worktree /workspace',
      'HEAD 7ea509a',
      'branch refs/heads/master',
      '',
      'worktree /workspace/.claude/worktrees/feature-a',
      'HEAD c65f09d',
      'branch refs/heads/feat/a',
      '',
    ].join('\n');

    expect(parseWorktreeList(porcelain)).toEqual([MAIN, A]);
  });
});
