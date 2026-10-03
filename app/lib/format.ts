/** Форматування грошей і діапазонів — спільне для таблиці й акордеонів. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 2028-03-04 → 04.03.2028. Не через Intl: дата з правил без часу й зони, зсуву не має бути. */
export function formatDate(iso: string): string {
  const m = ISO_DATE.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Змінні тексту з `calc/`: дати ISO стають датами для людини, решта — як є. */
export function formatVars(vars: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!vars) return undefined;
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, formatDate(v)]));
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatRange(range: { min: number; max: number }): string {
  return `${formatMoney(range.min)} – ${formatMoney(range.max)}`;
}

/**
 * Українська множина за числом: 1 правило, 2–4 правила, 5+ правил. 11–14
 * завжди третя форма (11 правил), а 21, 22… знову перша й друга.
 */
export function pluralUk(n: number, forms: readonly [one: string, few: string, many: string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Число разом зі словом у правильній формі: шаблон форми несе `{n}`. */
export function formatCount(n: number, forms: readonly [one: string, few: string, many: string]): string {
  return pluralUk(n, forms).replace('{n}', String(n));
}
