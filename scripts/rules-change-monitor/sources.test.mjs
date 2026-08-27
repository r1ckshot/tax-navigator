import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { amountNear, fetchSource, noExtractorCheck, EXTRACTORS } from './sources.mjs';
import { normalizeNumber } from './normalize.mjs';
import { STATES } from './states.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const zusPage = readFileSync(join(HERE, '__fixtures__', 'zus-skladki.html'), 'utf8');

/**
 * Фікстура — зріз живої сторінки zus.pl від 2026-08-26. Дефект, заради якого
 * вона тут: маркер «minimalne wynagrodzenie» трапляється спершу в навігації,
 * де числа немає, і лише потім у контенті поруч зі ставкою. Перша версія
 * витягу брала перше входження і повертала «120» — число з навігації, яке
 * поїхало б у звіт як значення джерела. Знайдено живим прогоном циклу.
 */
describe('amountNear: навігація не має видаватись за значення', () => {
  it('витягує саме ставку з контенту, а не перше число після першого маркера', () => {
    const raw = amountNear(zusPage, /100\s*%\s*minimalnego\s+wynagrodze/i);
    expect(raw).not.toBeNull();
    expect(normalizeNumber(raw)).toBe(4806);
  });

  // На цій сторінці ставка стоїть ПЕРЕД маркером, тож напрямок пошуку —
  // частина дефекту, а не деталь реалізації.
  it('сума перед маркером у тому ж реченні знаходиться так само', () => {
    expect(amountNear('kwota 4 806 zł (100% minimalnego wynagrodzenia)', /minimaln/i)).toBe('4 806 zł');
  });

  it('із двох сум поруч бере виразно ближчу до маркера', () => {
    const text = 'skladka 622,93 zł w innym zdaniu, a tu kwota 4 806 zł (100% minimalnego wynagrodzenia)';
    expect(normalizeNumber(amountNear(text, /minimalneg/i))).toBe(4806);
  });

  /**
   * Найдорожча знахідка живого прогону: дві майже рівновіддалені суми — це
   * неоднозначна прив'язка, а не привід узяти ближчу. Вгадування тут дало
   * розбіжність -62,79% на правилі, де джерело насправді збігається з матрицею.
   */
  it('дві рівновіддалені суми — null, а не ближча з них', () => {
    expect(amountNear('1 788,29 zł minimalneg 4 806 zł', /minimalneg/i)).toBeNull();
  });

  it('без валютної позначки число не рахується сумою', () => {
    expect(amountNear('<p>minimalne wynagrodzenie lvl3-link 120</p>', /minimalne/i)).toBeNull();
  });

  it('маркера немає — null, а не перше число сторінки', () => {
    expect(amountNear('<p>4 806 zł</p>', /minimalne/i)).toBeNull();
  });

  it('не рядок — null, а не виняток', () => {
    expect(amountNear(null, /x/)).toBeNull();
  });
});

describe('fetchSource: недоступність називається, а не ковтається', () => {
  it('не-2xx дає причину з кодом і жодного html', async () => {
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'x' }),
    });
    expect(result.html).toBeNull();
    expect(result.failure_reason).toContain('503');
  });

  it('кинуту помилку мережі перетворює на причину, а не на порожній html', async () => {
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => {
        throw new Error('ECONNRESET');
      },
    });
    expect(result.html).toBeNull();
    expect(result.failure_reason).toContain('ECONNRESET');
  });
});

describe('noExtractorCheck', () => {
  it('правило без екстрактора — поза скоупом, із названою причиною', () => {
    const check = noExtractorCheck({ rule_id: 'x', source_url: 'https://zus.pl/a', verified_at: '2026-01-01' });
    expect(check.state).toBe(STATES.OUT_OF_SCOPE);
    expect(check.failure_reason).toMatch(/патерну витягу/);
    expect(check.source_url).toBe('https://zus.pl/a');
  });
});

describe('EXTRACTORS', () => {
  it('кожен запис має url, matrixValue і extract', () => {
    for (const [ruleId, extractor] of Object.entries(EXTRACTORS)) {
      expect(extractor.url, ruleId).toMatch(/^https:\/\//);
      expect(typeof extractor.matrixValue, ruleId).toBe('function');
      expect(typeof extractor.extract, ruleId).toBe('function');
    }
  });
});
