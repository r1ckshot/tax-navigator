import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Друга половина dependency rule (ARCHITECTURE.md).
 *
 * `npm run test:arch` перевіряє граф ІМПОРТІВ, але браузерне API імпорту не
 * має: `window.sessionStorage` — глобал, у графі його не видно. Тому межу
 * «розрахунок мусить рахуватись у голому Node» тримає скан тексту.
 *
 * `__tests__` навмисно поза скануванням: цей файл сам містить назви глобалів.
 */

const LIB = join(process.cwd(), 'app', 'lib');

/** Єдиний файл, якому дозволено торкатись браузера — адаптер чернетки анкети. */
const BROWSER_ADAPTERS = ['app/lib/storage.ts'];

const BROWSER_GLOBAL = /\b(?:window|document|navigator|localStorage|sessionStorage)\s*[.[]/;

/** Коментар — не код: згадка `window.` у поясненні не мусить валити тест. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : tsFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const files = tsFiles(LIB).map((f) => relative(process.cwd(), f).split(sep).join('/'));

describe('dependency rule: браузерні глобали', () => {
  it('поза дозволеними адаптерами app/lib не торкається браузера', () => {
    const offenders = files
      .filter((f) => !BROWSER_ADAPTERS.includes(f))
      .filter((f) => BROWSER_GLOBAL.test(stripComments(readFileSync(f, 'utf8'))));

    expect(offenders).toEqual([]);
  });

  it('дозвіл не протух: кожен файл зі списку справді використовує браузерне API', () => {
    // Інакше allowlist тихо перетворюється на дірку для наступного файла.
    for (const allowed of BROWSER_ADAPTERS) {
      expect(files, `${allowed} зі списку більше не існує`).toContain(allowed);
      expect(
        BROWSER_GLOBAL.test(stripComments(readFileSync(allowed, 'utf8'))),
        `${allowed} більше не використовує браузерне API — прибери його зі списку`,
      ).toBe(true);
    }
  });

  it('скан бачить увесь app/lib, а не порожній список', () => {
    expect(files.length).toBeGreaterThan(10);
  });
});

/**
 * Третя межа: мова інтерфейсу (ARCHITECTURE.md, «Текст користувачу → i18n/uk.ts»).
 *
 * До цього правило трималось самою дисципліною — на відміну від решти таблиці,
 * і саме воно єдине протекло: `app/layout.tsx` показував користувачу «Tax
 * Navigator» повз `t()`, тоді як `uk.ts` містив зовсім іншу назву продукту.
 *
 * Ловимо саме КИРИЛИЧНИЙ літерал: гліфи (`●▲■`), `'+'` і роздільники — не текст
 * для читання, вони лишаються в компонентах законно.
 */
const TSX = join(process.cwd(), 'app');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : tsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

const CYRILLIC_LITERAL = /(["'`])((?:(?!\1)[\s\S])*?[Ѐ-ӿ](?:(?!\1)[\s\S])*?)\1/g;

const tsx = tsxFiles(TSX).map((f) => relative(process.cwd(), f).split(sep).join('/'));

describe('мова інтерфейсу: тексти живуть лише в i18n', () => {
  it('жоден .tsx не містить кириличного рядка-літерала', () => {
    const offenders = tsx.flatMap((f) => {
      const source = stripComments(readFileSync(f, 'utf8'));
      return [...source.matchAll(CYRILLIC_LITERAL)].map((m) => `${f}: ${m[0].slice(0, 60)}`);
    });

    expect(offenders).toEqual([]);
  });

  it('скан бачить усі компоненти й сторінки, а не порожній список', () => {
    // Без цього поламаний обхід дав би вічнозелений тест ні на чому.
    expect(tsx.length).toBeGreaterThan(8);
    expect(tsx).toContain('app/layout.tsx');
  });
});
