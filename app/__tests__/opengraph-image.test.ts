import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PNG = readFileSync(fileURLToPath(new URL('../opengraph-image.png', import.meta.url)));

describe('opengraph-image.png', () => {
  // Розмір читається з IHDR: ширина й висота — big-endian на байтах 16-23.
  it('1200×630, формат, який месенджери показують великою карткою', () => {
    expect(PNG.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([PNG.readUInt32BE(16), PNG.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  // Facebook і Telegram мовчки відкидають прев'ю, важче за кілька МБ.
  it('легша за 300 КБ', () => {
    expect(PNG.length).toBeLessThan(300_000);
  });
});
