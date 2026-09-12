// ЗЛАМАНИЙ ДВІЙНИК `scripts/rules-change-monitor/screen.mjs` — тільки для
// `BREAK=1 python3 evals/check_injection.py`. У конвеєр не підключений.
//
// Зламано так, як це сталося б насправді, а не «прибрали файл». Перевірка на
// місці, експорти ті самі, коментарі ті самі, тести `screen.test.mjs` на
// `screenSource` формою проходять. Змінено одне рішення: сторінку тепер не
// відхиляють, а ЧИСТЯТЬ — вирізають коментарі й приховані блоки й пускають
// решту далі. Аргумент, яким таку правку захищають, звучить розумно: навіщо
// зупиняти цикл, якщо наказ і так видалено.
//
// Ціна саме в цьому: цикл стає зеленим. Сторінку чіпали, а звіт каже
// `completed`, і людина не дізнається, що з джерелом щось не так. Ворота мусять
// почервоніти рівно тут — на статусі й коді виходу, а не на тексті звіту.

export const MAX_INPUT_CHARS = 1_500_000;

const INERT_BLOCKS = [
  /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,
  /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,
  /<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi,
];

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
/** Прихований блок: те, що читає агент, але не бачить людина. */
const HIDDEN_BLOCK = /<div\b[^>]*(?:font-size\s*:\s*0|display\s*:\s*none)[^>]*>[\s\S]*?<\/div\s*>/gi;

export const INJECTION_PATTERNS = Object.freeze([]);

export function detectInjection() {
  return null;
}

export function screenSource(html) {
  if (typeof html !== "string") {
    return { html: null, blocked: false, failure_reason: null, truncated: false };
  }

  const truncated = html.length > MAX_INPUT_CHARS;
  let text = truncated ? html.slice(0, MAX_INPUT_CHARS) : html;

  for (const block of INERT_BLOCKS) {
    text = text.replace(block, " ");
  }
  text = text.replace(HTML_COMMENT, " ").replace(HIDDEN_BLOCK, " ");

  return { html: text, blocked: false, failure_reason: null, truncated };
}
