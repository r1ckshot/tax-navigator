#!/usr/bin/env node
/**
 * Рендер `app/opengraph-image.png` (1200×630) — прев'ю лінка в месенджерах.
 *
 * Статичний PNG, а не `next/og`: той рендерить на Edge зі своїм шрифтом, і
 * кирилицю довелося б тягнути мережею під час збірки. Тут текст береться з
 * `uk.ts`, щоб прев'ю не розійшлося з назвою й лідом в інтерфейсі, а кольори
 * з палітри `globals.css`. Цифр на картинці немає свідомо: число без джерела
 * поруч порушило б evidence-numbers.md.
 *
 * Запуск після зміни `app.title`, `app.lead` чи `app.trust`:
 *   node scripts/og/render.mjs
 * Потрібні ImageMagick (`convert`) і шрифт DejaVu Sans (є в девконтейнері).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { uk } from '../../app/lib/i18n/uk.ts';

const OUT = fileURLToPath(new URL('../../app/opengraph-image.png', import.meta.url));

// Палітра з globals.css (світла тема): --plane, --surface, --ink, --ink-secondary, --accent.
const PLANE = '#e7e4da';
const SURFACE = '#fefdfb';
const INK = '#1c1a13';
const INK_2 = '#56534b';
const ACCENT = '#0f766e';

const [name, pair] = uk['app.title'].split(/\s+(?=\S+$)/); // «Податковий навігатор» + «UA↔PL»

execFileSync('convert', [
  '-size', '1200x630', `xc:${PLANE}`,
  '-fill', SURFACE, '-stroke', '#cdcbc2', '-strokewidth', '2',
  '-draw', 'roundrectangle 48,48 1152,582 24,24',
  '-stroke', 'none',
  '-fill', ACCENT, '-draw', 'roundrectangle 48,48 64,582 8,8',
  '-font', 'DejaVu-Sans-Bold',
  '-fill', ACCENT, '-pointsize', '34', '-annotate', '+120+150', pair,
  '-fill', INK, '-pointsize', '68', '-annotate', '+116+246', name,
  '-font', 'DejaVu-Sans',
  '(', '-size', '940x', '-background', 'none', '-fill', INK_2, '-font', 'DejaVu-Sans',
  '-pointsize', '40', '-interline-spacing', '10', `caption:${uk['app.lead']}`, ')',
  '-geometry', '+120+300', '-composite',
  '-fill', ACCENT, '-pointsize', '28', '-annotate', '+120+530', uk['app.trust'],
  '-depth', '8', '-strip', OUT,
]);

console.log(`OK: ${OUT}`);
