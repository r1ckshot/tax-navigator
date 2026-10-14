import type { CSSProperties } from 'react';
import localFont from 'next/font/local';

/**
 * Шрифти напряму «Реєстр»: Source Serif 4 у заголовках, Inter у тексті.
 *
 * Самохостинг із npm (`@fontsource-variable/*`) через `next/font/local`, а не
 * `next/font/google`: Google Fonts з девконтейнера недосяжні, і локальне
 * превʼю показувало б системний шрифт замість справжнього. Тепер збірка не
 * ходить у мережу взагалі, а локально видно те саме, що на Vercel.
 *
 * Файли fontsource нарізані за підмножинами юнікоду, а `next/font/local` не
 * вміє дати кожному файлу свій `unicode-range` в одному виклику. Тож підмножина
 * = окремий виклик (окрема родина), а родини стають у стек: браузер бере
 * гліф із першої, що його має, і не качає файл, чий діапазон на сторінці не
 * трапився. Запасний шрифт з підігнаними метриками (менше зсуву при заміні)
 * генерує лише останній виклик стека — інакше системний сериф перехопив би
 * кирилицю ще до кириличного файла.
 *
 * Лише вісь ваги (`wght`), без optical size: сериф ~130 КБ замість ~320 КБ.
 */


// Аргументи loader-а мусять бути літералами (next/font читає їх статично),
// тож діапазони юнікоду — ті самі, що у CSS `@fontsource-variable/*`, —
// повторені в кожному виклику, а не винесені в константу.
const serifLatin = localFont({
  src: [
    { path: '../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2', style: 'normal' },
    // Курсив — для «map» у знаку nettomap.
    { path: '../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '200 900',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' }],
});
const serifLatinExt = localFont({
  src: '../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-ext-wght-normal.woff2',
  weight: '200 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' }],
});
const serifCyrillic = localFont({
  src: '../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-cyrillic-wght-normal.woff2',
  weight: '200 900',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  declarations: [{ prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' }],
});

const sansLatin = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' }],
});
const sansLatinExt = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' }],
});
const sansCyrillic = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'unicode-range', value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' }],
});

const stack = (...fonts: { style: { fontFamily: string } }[]) => fonts.map((f) => f.style.fontFamily).join(', ');

/**
 * Змінні для `<html style>`: `globals.css` читає їх у `--font-display` і
 * `--font-body`. Компоненти шрифтів напряму не знають — лише ці дві ролі.
 */
export const fontFaces = {
  '--font-serif-face': stack(serifLatin, serifLatinExt, serifCyrillic),
  '--font-sans-face': stack(sansLatin, sansLatinExt, sansCyrillic),
} as CSSProperties;
