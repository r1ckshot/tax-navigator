#!/usr/bin/env node
/**
 * Рендер `app/[locale]/opengraph-image.png` (1200×630) — прев'ю лінка в месенджерах.
 *
 * Статичний PNG, а не `next/og`: той рендерить на Edge зі своїм шрифтом, і
 * кирилицю довелося б тягнути мережею під час збірки. Тут текст береться з
 * `uk.ts`, кольори — з палітри `globals.css`, шрифти — ті самі woff2 з
 * `@fontsource-variable/*`, що й на сайті (ImageMagick читає woff2 сам). Цифр на
 * картинці немає свідомо: число без джерела поруч порушило б evidence-numbers.md.
 *
 * Картинка спільна для лендінгу бренду й сторінок Польщі, тож на ній знак
 * nettomap і підзаголовок бренду, а не назва країни.
 *
 * Пастка підмножин: кириличний файл fontsource не має ні цифр, ні тире, ні
 * розділових знаків — вони в латинському. ImageMagick не перемикає шрифт
 * посеред рядка, тож такий символ вийшов би порожнім місцем. Скрипт падає,
 * якщо текст виходить за кирилицю й пробіл.
 *
 * Запуск після зміни `brand.title`:
 *   node scripts/og/render.mjs
 * Потрібен ImageMagick (`convert`), є в девконтейнері.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Рядок словника читається з тексту `uk.ts`, а не імпортом: словник тягне
 * `./translate` без розширення, і голий node такий імпорт не резолвить.
 */
function ukString(key) {
  const source = readFileSync(new URL('../../app/lib/i18n/uk.ts', import.meta.url), 'utf8');
  const match = new RegExp(`'${key.replace('.', '\\.')}':\\s*'([^']*)'`).exec(source);
  if (!match) throw new Error(`OG: ключа ${key} немає в uk.ts`);
  return match[1];
}

const OUT = fileURLToPath(new URL('../../app/[locale]/opengraph-image.png', import.meta.url));
const FONTS = fileURLToPath(new URL('../../node_modules/@fontsource-variable/', import.meta.url));
const SERIF = `${FONTS}source-serif-4/files/source-serif-4-latin-wght-normal.woff2`;
const SERIF_ITALIC = `${FONTS}source-serif-4/files/source-serif-4-latin-wght-italic.woff2`;
const SERIF_CYRILLIC = `${FONTS}source-serif-4/files/source-serif-4-cyrillic-wght-normal.woff2`;

// Палітра з globals.css (світла тема): --plane, --ink, --ink-secondary, --accent, --hairline-strong.
const PLANE = '#f0ece3';
const INK = '#1c1914';
const INK_2 = '#534f48';
const ACCENT = '#214a9b';
const HAIRLINE = '#d0ccc2';

// «nettomap: податки і дохід …» → «Податки і дохід …».
const tail = ukString('brand.title').split(': ')[1] ?? '';
const tagline = tail.charAt(0).toUpperCase() + tail.slice(1);
if (!/^[Ѐ-џҐґ ]+$/.test(tagline)) {
  throw new Error(`OG: «${tagline}» має символи поза кириличною підмножиною шрифту — їх не буде на картинці`);
}

const LEFT = 96;
const MARK_SIZE = 168;
const BASELINE = 300;

/** Ширина слова в пікселях — щоб «map» став упритул за «netto». */
const width = (font, size, text) =>
  Number(execFileSync('convert', ['-font', font, '-pointsize', String(size), `label:${text}`, '-format', '%w', 'info:']).toString());

const netto = width(SERIF, MARK_SIZE, 'netto');

execFileSync('convert', [
  '-size', '1200x630', `xc:${PLANE}`,
  // Лінійка чорнилом зверху й тонка під знаком — як шапка й реєстр на сайті.
  '-fill', INK, '-draw', `rectangle ${LEFT},96 ${1200 - LEFT},99`,
  '-font', SERIF, '-fill', INK, '-pointsize', String(MARK_SIZE), '-annotate', `+${LEFT - 6}+${BASELINE}`, 'netto',
  '-font', SERIF_ITALIC, '-fill', ACCENT, '-annotate', `+${LEFT - 6 + netto}+${BASELINE}`, 'map',
  '-fill', HAIRLINE, '-draw', `rectangle ${LEFT},378 ${1200 - LEFT},379`,
  '(', '-size', `${1200 - 2 * LEFT}x`, '-background', 'none', '-fill', INK_2, '-font', SERIF_CYRILLIC,
  '-pointsize', '50', '-interline-spacing', '8', `caption:${tagline}`, ')',
  '-geometry', `+${LEFT}+410`, '-composite',
  '-depth', '8', '-strip', OUT,
]);

console.log(`OK: ${OUT}`);
