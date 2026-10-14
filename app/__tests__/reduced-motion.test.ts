import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * «Зменшити рух» вимикає рух повністю: одразу кінцевий стан
 * (design/brief-redesign.md, «Рух»). Браузера в контейнері немає, тож перевірка
 * статична: кожне правило, що оголошує `animation` чи `transition`, мусить мати
 * той самий селектор у блоці `@media (prefers-reduced-motion: reduce)` того ж
 * файла. Нове правило з рухом без вимкнення валить тест — саме цю пастку легко
 * пропустити очима, бо на машині автора рух зазвичай увімкнений.
 */

const APP = join(__dirname, '..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

interface Rule {
  selectors: string[];
  body: string;
  reduced: boolean;
}

/** Мінімальний розбір CSS: правила з урахуванням вкладених @media; @keyframes пропускаються. */
function parse(css: string, reduced = false): Rule[] {
  const rules: Rule[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const block = css.slice(open + 1, j - 1);
    if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
      rules.push(...parse(block, reduced || /prefers-reduced-motion:\s*reduce/.test(prelude)));
    } else if (!prelude.startsWith('@')) {
      rules.push({ selectors: prelude.split(',').map((s) => s.replace(/\s+/g, ' ').trim()), body: block, reduced });
    }
    i = j;
  }
  return rules;
}

/** Чи оголошує тіло правила рух (значення `none` — це вже вимкнення). */
function declaresMotion(body: string): boolean {
  return /(?:^|;)\s*(?:animation|transition)\s*:\s*(?!none\b)[^;]+/.test(body);
}

/** `::view-transition-old(*)` у блоці вимкнення покриває будь-яке імʼя переходу. */
function covers(reducedSelector: string, selector: string): boolean {
  if (reducedSelector === selector) return true;
  if (!reducedSelector.includes('(*)')) return false;
  const pattern = reducedSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\\\*\\\)/g, '\\([^)]+\\)');
  return new RegExp(`^${pattern}$`).test(selector);
}

const files = cssFiles(APP).filter((f) => !f.includes('__tests__'));

describe('prefers-reduced-motion: reduce', () => {
  it('у застосунку є CSS-файли з рухом (тест не порожній)', () => {
    const withMotion = files.filter((f) => parse(stripComments(readFileSync(f, 'utf8'))).some((r) => declaresMotion(r.body)));
    expect(withMotion.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const rules = parse(stripComments(readFileSync(file, 'utf8')));
    const moving = rules.filter((r) => !r.reduced && declaresMotion(r.body)).flatMap((r) => r.selectors);
    if (moving.length === 0) continue;

    it(`${relative(APP, file)}: кожен селектор із рухом вимкнено`, () => {
      const reducedSelectors = rules.filter((r) => r.reduced).flatMap((r) => r.selectors);
      const uncovered = moving.filter((sel) => !reducedSelectors.some((r) => covers(r, sel)));
      expect(uncovered).toEqual([]);
    });
  }
});

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
