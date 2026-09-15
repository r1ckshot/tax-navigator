import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Межа двох шарів словника в app/globals.css: палітра тримає сирі значення,
 * ролі лише посилаються на палітру, компоненти читають лише ролі.
 *
 * CSS цієї межі не енфорсить: `--accent: #0f766e` валідний так само, як
 * `--accent: var(--teal-51)`, і рендериться однаково. Розповзається словник
 * саме так — по одному hex, кожен з яких нічого не ламає.
 */

const ROOT = process.cwd();
const GLOBALS = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');

/** Коментар — не декларація: згадка `#fff` у поясненні не мусить валити тест. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

type Decl = { name: string; value: string };

function declarations(block: string): Decl[] {
  return [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({
    name: m[1],
    value: m[2].trim(),
  }));
}

const css = stripComments(GLOBALS);
const darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
const lightBlock = css.slice(0, darkAt);
const darkBlock = css.slice(darkAt, css.indexOf('}', css.indexOf('}', darkAt) + 1));

const light = declarations(lightBlock);
const dark = declarations(darkBlock);

/**
 * Родини палітри перелічені явно: шаблон `імʼя-число` ловив би й `--space-1`.
 * Нова родина без запису тут класифікується як роль і валить тест «роль не
 * тримає hex» — тобто сама просить себе дописати.
 */
const PALETTE_NAME = /^--(?:(?:stone|teal|green|amber|red)-\d{1,2}|white)$/;
const HEX = /#[0-9a-f]{3,8}\b/i;
const RGB = /\brgba?\(/i;

const palette = light.filter((d) => PALETTE_NAME.test(d.name));
const roles = light.filter((d) => !PALETTE_NAME.test(d.name));

/**
 * OKLCH-світлота з sRGB hex, 0-100. Формула Björn Ottosson (оригінал OKLab):
 * sRGB → лінійний → LMS → кубічний корінь → L.
 */
function oklchLightness(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map(channel);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 100;
}

describe('словник: шар 1, палітра', () => {
  it('знайдено обидва шари (парсер не мовчить на порожньому файлі)', () => {
    // Без цього зламаний парсер дав би порожні масиви, і кожен тест нижче
    // пройшов би на нулі елементів.
    expect(palette.length).toBeGreaterThan(20);
    expect(roles.length).toBeGreaterThan(20);
    expect(dark.length).toBeGreaterThan(10);
  });

  it('палітра тримає лише сирий 6-значний hex', () => {
    const offenders = palette.filter((d) => !/^#[0-9a-f]{6}$/i.test(d.value));
    expect(offenders).toEqual([]);
  });

  it('число в імені дорівнює OKLCH-світлоті, округленій вниз', () => {
    const lying = palette
      .filter((d) => d.name !== '--white')
      .map((d) => ({
        name: d.name,
        value: d.value,
        lightness: Math.floor(oklchLightness(d.value)),
      }))
      .filter((d) => Number(d.name.split('-').pop()) !== d.lightness);
    expect(lying).toEqual([]);
  });

  it('анти-регрес формули: відомі точки шкали', () => {
    // Якщо тест вище зеленіє через зламану формулу, ці три точки це покажуть.
    expect(oklchLightness('#ffffff')).toBeCloseTo(100, 1);
    expect(oklchLightness('#000000')).toBeCloseTo(0, 5);
    expect(Math.floor(oklchLightness('#0f766e'))).toBe(51);
  });

  it('жодного кольору палітри без ролі, що його читає', () => {
    // Словник роздувається саме так: колір додали «на потім».
    const referenced = new Set(
      [...light, ...dark].flatMap((d) => [...d.value.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])),
    );
    const orphans = palette.map((d) => d.name).filter((n) => !referenced.has(n));
    expect(orphans).toEqual([]);
  });

  it('темна тема палітру не перевизначає, лише ролі', () => {
    expect(dark.filter((d) => PALETTE_NAME.test(d.name))).toEqual([]);
  });
});

describe('словник: шар 2, ролі', () => {
  it('жодна роль не тримає hex, в обох темах', () => {
    const offenders = [...roles, ...dark].filter((d) => HEX.test(d.value));
    expect(offenders).toEqual([]);
  });

  it('rgba дозволено лише в тінях', () => {
    const offenders = [...roles, ...dark].filter((d) => RGB.test(d.value) && !d.name.startsWith('--shadow-'));
    expect(offenders).toEqual([]);
  });

  it('роль посилається на існуючий колір палітри', () => {
    const known = new Set(palette.map((d) => d.name));
    const dangling = [...roles, ...dark].flatMap((d) =>
      [...d.value.matchAll(/var\((--[\w-]+)\)/g)]
        .map((m) => m[1])
        .filter((n) => PALETTE_NAME.test(n) && !known.has(n))
        .map((n) => `${d.name} → ${n}`),
    );
    expect(dangling).toEqual([]);
  });
});

describe('словник: компоненти', () => {
  function cssModules(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'lib' ? [] : cssModules(full);
      return entry.name.endsWith('.module.css') ? [full] : [];
    });
  }

  const modules = cssModules(join(ROOT, 'app')).map((f) => ({
    path: relative(ROOT, f).split(sep).join('/'),
    css: stripComments(readFileSync(f, 'utf8')),
  }));

  it('знайдено CSS-модулі', () => {
    expect(modules.length).toBeGreaterThan(5);
  });

  it('компонент не тримає сирого кольору', () => {
    const offenders = modules.filter((m) => HEX.test(m.css) || RGB.test(m.css)).map((m) => m.path);
    expect(offenders).toEqual([]);
  });

  it('компонент не читає палітру в обхід ролей', () => {
    // Інакше темна тема до такого місця не доїде: вона перемикає ролі.
    const names = palette.map((d) => d.name);
    const offenders = modules
      .flatMap((m) => names.filter((n) => m.css.includes(`var(${n})`)).map((n) => `${m.path}: ${n}`));
    expect(offenders).toEqual([]);
  });
});
