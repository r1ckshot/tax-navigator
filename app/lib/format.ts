/** Форматування грошей і діапазонів — спільне для таблиці й акордеонів. */

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatRange(range: { min: number; max: number }): string {
  return `${formatMoney(range.min)} – ${formatMoney(range.max)}`;
}
