/**
 * Читання словника дизайн-токенів із тексту `app/globals.css`.
 *
 * Сторінка `/tokens` показує словник, але не тримає власного списку токенів:
 * такий список був би двійником CSS і розійшовся б із ним на першій правці.
 * Тож джерело одне — сам CSS, а цей модуль лише розбирає його текст.
 *
 * Чиста функція без файлової системи: текст читає сторінка, тут його розбирають.
 */

export type Token = { name: string; value: string };

/** Роль кольору: на який колір палітри вказує в кожній темі. */
export type ColorRole = { name: string; light: string; dark: string };

export type TokenDictionary = {
  palette: Token[];
  colorRoles: ColorRole[];
  text: Token[];
  space: Token[];
  radius: Token[];
};

/** Родини палітри перелічені явно — та сама межа, що в design-tokens.test.ts. */
const PALETTE_NAME = /^--(?:(?:stone|teal|green|amber|red)-\d{1,2}|white)$/;
const DARK_THEME = '@media (prefers-color-scheme: dark)';

function declarations(block: string): Token[] {
  return [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({
    name: m[1],
    value: m[2].trim(),
  }));
}

/** `var(--teal-51)` → `--teal-51`; усе, що не є рівно одним посиланням, — null. */
function reference(value: string): string | null {
  return /^var\((--[\w-]+)\)$/.exec(value)?.[1] ?? null;
}

export function parseTokens(css: string): TokenDictionary {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const darkAt = source.indexOf(DARK_THEME);
  const lightBlock = darkAt === -1 ? source : source.slice(0, darkAt);
  // Блок темної теми закривається двома дужками: :root усередині @media.
  const darkBlock =
    darkAt === -1 ? '' : source.slice(darkAt, source.indexOf('}', source.indexOf('}', darkAt) + 1));

  const light = declarations(lightBlock);
  const dark = new Map(declarations(darkBlock).map((d) => [d.name, d.value]));

  const palette = light.filter((d) => PALETTE_NAME.test(d.name));

  const colorRoles = light.flatMap((d) => {
    const lightRef = reference(d.value);
    if (PALETTE_NAME.test(d.name) || lightRef === null || !PALETTE_NAME.test(lightRef)) return [];
    // Роль без перевизначення в темній темі (статуси ризику) лишається тією самою.
    const darkRef = reference(dark.get(d.name) ?? d.value) ?? lightRef;
    return [{ name: d.name, light: lightRef, dark: darkRef }];
  });

  const scale = (prefix: string) => light.filter((d) => d.name.startsWith(prefix));

  return {
    palette,
    colorRoles,
    text: scale('--text-'),
    space: scale('--space-'),
    radius: scale('--radius'),
  };
}
