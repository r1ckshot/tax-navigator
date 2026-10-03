#!/usr/bin/env node
// Контраст ролей кольору за WCAG 2.x — для словника `app/globals.css` і для тем
// напрямів редизайну (`app/(technical)/design-lab/*/theme.css`).
//
//   node scripts/contrast.mjs <file.css> [<file.css> …]
//
// Рахує не «всі кольори з усіма», а пари, які реально стоять на екрані: текстові
// ролі на фонових, текст кнопки на акценті. Поріг — AA для звичайного тексту
// (4.5:1): дрібний підпис `--ink-muted` у продукті є, тож поблажки 3:1 для
// великого кегля не беремо. Кольори ризику — лише звіт, не провал: жовтий 3:1 на
// світлому не дає, і це компенсує форма + текст (product-safety.md).
//
// Два формати опису теми:
//   globals.css   ролі в `:root`, темна тема — у `@media (prefers-color-scheme: dark)`;
//   theme.css     роль одним рядком: `--ink: light-dark(var(--x-20), var(--x-96))`.
// Вихід 1, якщо хоч одна пара в будь-якій темі нижча за AA.
import { readFileSync } from 'node:fs';

const AA = 4.5;
const TEXT = ['--ink', '--ink-secondary', '--ink-muted', '--accent'];
const BACKGROUNDS = ['--surface', '--plane', '--sunken', '--accent-soft'];
const BUTTON = [
  ['--accent-ink', '--accent'],
  ['--accent-ink', '--accent-hover'],
];
const RISK = ['--risk-green', '--risk-yellow', '--risk-red'];

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const decls = (block) =>
  [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({ name: m[1], value: m[2].trim() }));

/** Відносна яскравість sRGB за WCAG 2.x. */
function luminance(hex) {
  const ch = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Тема → { light: Map(роль → hex), dark: Map(роль → hex) }. */
export function resolveTheme(source) {
  const css = stripComments(source);
  const darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
  const all = decls(css);
  const palette = new Map(all.filter((d) => /^#[0-9a-f]{6}$/i.test(d.value)).map((d) => [d.name, d.value]));
  const ref = (v) => palette.get(/^var\((--[\w-]+)\)$/.exec(v.trim())?.[1]);

  const light = new Map();
  const dark = new Map();
  const base = darkAt === -1 ? all : decls(css.slice(0, darkAt));
  for (const d of base) {
    const pair = /^light-dark\(\s*(var\(--[\w-]+\))\s*,\s*(var\(--[\w-]+\))\s*\)$/.exec(d.value);
    if (pair) {
      light.set(d.name, ref(pair[1]));
      dark.set(d.name, ref(pair[2]));
    } else if (ref(d.value)) {
      light.set(d.name, ref(d.value));
      dark.set(d.name, ref(d.value));
    }
  }
  if (darkAt !== -1) {
    for (const d of decls(css.slice(darkAt))) if (ref(d.value)) dark.set(d.name, ref(d.value));
  }
  return { light, dark };
}

function check(file) {
  const theme = resolveTheme(readFileSync(file, 'utf8'));
  const rows = [];
  for (const [mode, roles] of Object.entries(theme)) {
    const pairs = [
      ...TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg])),
      ...BUTTON,
    ];
    for (const [fg, bg] of pairs) {
      if (!roles.get(fg) || !roles.get(bg)) {
        rows.push({ mode, fg, bg, value: NaN, pass: false });
        continue;
      }
      const value = ratio(roles.get(fg), roles.get(bg));
      rows.push({ mode, fg, bg, value, pass: value >= AA });
    }
    for (const fg of RISK) {
      if (roles.get(fg) && roles.get('--surface')) {
        rows.push({ mode, fg, bg: '--surface', value: ratio(roles.get(fg), roles.get('--surface')), info: true });
      }
    }
  }
  return rows;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node scripts/contrast.mjs <file.css> […]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const rows = check(file);
  const graded = rows.filter((r) => !r.info);
  const fails = graded.filter((r) => !r.pass);
  const min = (mode) => Math.min(...graded.filter((r) => r.mode === mode).map((r) => r.value));
  console.log(`\n${file}`);
  console.log(`  пар: ${graded.length}, нижче AA: ${fails.length}; мінімум світла ${min('light').toFixed(2)}, темна ${min('dark').toFixed(2)}`);
  for (const r of fails) {
    console.log(`  FAIL ${r.mode.padEnd(5)} ${r.fg} на ${r.bg}: ${Number.isNaN(r.value) ? 'роль не знайдено' : r.value.toFixed(2)}`);
  }
  for (const r of rows.filter((x) => x.info)) {
    console.log(`  info ${r.mode.padEnd(5)} ${r.fg} на ${r.bg}: ${r.value.toFixed(2)} (ризик: форма + текст)`);
  }
  if (fails.length) failed = true;
}
process.exit(failed ? 1 : 0);
