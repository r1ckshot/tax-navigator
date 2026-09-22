import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './telegram.ts';

afterEach(() => vi.restoreAllMocks());

describe('createClient', () => {
  // stdout команди `sample` — це файл вибірки: будь-який рядок бібліотеки
  // перед JSON робить його нечитним (2026-09-21, банер версії gramJS).
  it('не пише в stdout нічого', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createClient(1, 'hash', '');
    expect(log).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
