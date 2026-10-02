import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pageText } from './extract.mjs';
import { buildPrompt, checkLlmField, MAX_LLM_INPUT_CHARS, verifyAnswer } from './llm.mjs';
import { STATES } from './states.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** biznes.gov.pl/00115, знята 2026-10-01: ліміт 3 604,50 zł стоїть у тексті прозою. */
const NIEREJ = pageText(readFileSync(join(HERE, '__fixtures__', 'pages', 'nierej.html'), 'utf8'));

/** Речення з фікстури дослівно — так, як його повертає модель. */
const LIMIT_SENTENCE = 'Limit kwartalnych przychodów dla działalności nierejestrowej w 2026 roku wynosi 10813,50 zł';
const GOODS_SENTENCE = 'Nie będziesz mieć obowiązku opłacania składek na ubezpieczenia społeczne ani ubezpieczenie zdrowotne, jeśli w ramach działalności nierejestrowanej sprzedajesz towary';

describe('фікстура несе речення, на яких стоять тести', () => {
  it('обидва речення є в тексті сторінки дослівно', () => {
    expect(NIEREJ).toContain(LIMIT_SENTENCE);
    expect(NIEREJ).toContain(GOODS_SENTENCE);
  });
});

describe('verifyAnswer: число', () => {
  /**
   * Еталон: 10 813,50 zł (на сторінці «10813,50 zł») — квартальний ліміт 2026 = 225% × 4 806 (мінімалка),
   * саме це число несе `nierejestrowana.limit.quarterlyLimit`.
   */
  it('цитата дослівна, число в цитаті й дорівнює матриці → збігається', () => {
    const v = verifyAnswer({ answer: { value: 10813.5, quote: LIMIT_SENTENCE }, text: NIEREJ, type: 'number', matrix: 10813.5 });
    expect(v.state).toBe(STATES.MATCH);
  });

  /**
   * Мутація кроку 5: число на сторінці підмінене. Модель чесно читає нове
   * число, цитата дослівна — значить, змінилось джерело, і це розбіжність.
   */
  it('мутація: число у фікстурі підмінене → розбіжність', () => {
    const text = NIEREJ.replace('10813,50 zł', '11000,00 zł');
    const quote = LIMIT_SENTENCE.replace('10813,50 zł', '11000,00 zł');
    const v = verifyAnswer({ answer: { value: 11000, quote }, text, type: 'number', matrix: 10813.5 });
    expect(v.state).toBe(STATES.DIVERGENCE);
    expect(v.fetched_value).toBe(11000);
  });

  /** Мутація кроку 5: цитату моделі змінено — її немає на сторінці. */
  it('мутація: цитата підмінена → не вдалось перевірити, навіть коли число «збіглось»', () => {
    const quote = LIMIT_SENTENCE.replace('kwartalnych', 'miesięcznych');
    const v = verifyAnswer({ answer: { value: 10813.5, quote }, text: NIEREJ, type: 'number', matrix: 10813.5 });
    expect(v.state).toBe(STATES.UNAVAILABLE);
    expect(v.failure_reason).toContain('дослівно немає');
  });

  it('число не з цитати → не вдалось перевірити', () => {
    const v = verifyAnswer({ answer: { value: 4806, quote: LIMIT_SENTENCE }, text: NIEREJ, type: 'number', matrix: 4806 });
    expect(v.state).toBe(STATES.UNAVAILABLE);
    expect(v.failure_reason).toContain('у цитаті немає');
  });

  it('сусідні числа через пробіл не зливаються в одне', () => {
    const text = 'Stawki: 12 8 517 200 zł limit na rok podatkowy 2026.';
    const v = verifyAnswer({ answer: { value: 12, quote: text }, text, type: 'number', matrix: 12 });
    expect(v.state).toBe(STATES.MATCH);
  });
});

describe('verifyAnswer: так/ні', () => {
  it('дослівна цитата і значення як у матриці → збігається', () => {
    const v = verifyAnswer({ answer: { value: true, quote: GOODS_SENTENCE }, text: NIEREJ, type: 'boolean', matrix: true });
    expect(v.state).toBe(STATES.MATCH);
    expect(v.quote).toBe(GOODS_SENTENCE);
  });

  it('модель каже протилежне матриці на дослівній цитаті → розбіжність', () => {
    const v = verifyAnswer({ answer: { value: false, quote: GOODS_SENTENCE }, text: NIEREJ, type: 'boolean', matrix: true });
    expect(v.state).toBe(STATES.DIVERGENCE);
  });

  it('мутація: цитата підмінена → не вдалось перевірити', () => {
    const v = verifyAnswer({ answer: { value: true, quote: GOODS_SENTENCE.replace('towary', 'usługi') }, text: NIEREJ, type: 'boolean', matrix: true });
    expect(v.state).toBe(STATES.UNAVAILABLE);
  });

  it.each([
    ['без відповіді', null],
    ['модель не знайшла твердження', { value: null, quote: null }],
    ['цитата закоротка, щоб щось доводити', { value: true, quote: 'tak' }],
    ['значення не так/ні', { value: 'tak', quote: GOODS_SENTENCE }],
  ])('%s → не вдалось перевірити', (_, answer) => {
    expect(verifyAnswer({ answer, text: NIEREJ, type: 'boolean', matrix: true }).state).toBe(STATES.UNAVAILABLE);
  });

  it('пробіли й нерозривні пробіли в цитаті не ламають дослівність', () => {
    const quote = GOODS_SENTENCE.replace('ani ubezpieczenie', 'ani  ubezpieczenie');
    expect(verifyAnswer({ answer: { value: true, quote }, text: NIEREJ, type: 'boolean', matrix: true }).state).toBe(STATES.MATCH);
  });
});

describe('checkLlmField', () => {
  const rule = { rule_id: 'nierejestrowana.zus', params: { goodsSaleIsNoTitle: true }, source_url: 'https://www.biznes.gov.pl/pl/portal/00115', verified_at: '2026-08-03' };
  const spec = { type: 'boolean', question: 'Чи каже текст, що продаж товарів не створює обов\'язку składek?' };
  const base = { rule, param: 'goodsSaleIsNoTitle', spec, url: rule.source_url, failure_reason: null, matrix: true };

  it('одна відповідь на лист: промпт несе питання й текст сторінки', async () => {
    const prompts = [];
    const check = await checkLlmField({ ...base, text: NIEREJ, ask: async ({ prompt }) => (prompts.push(prompt), { value: true, quote: GOODS_SENTENCE }) });
    expect(check.state).toBe(STATES.MATCH);
    expect(check.method).toBe('llm');
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain(spec.question);
    expect(prompts[0]).toContain(GOODS_SENTENCE);
  });

  it('виклик моделі впав → недоступне з причиною, а не тиша', async () => {
    const check = await checkLlmField({ ...base, text: NIEREJ, ask: async () => { throw new Error('claude -p завершився з кодом 1'); } });
    expect(check.state).toBe(STATES.UNAVAILABLE);
    expect(check.failure_reason).toContain('кодом 1');
  });

  it('модель не підключена → недоступне, а не «збігається»', async () => {
    expect((await checkLlmField({ ...base, text: NIEREJ, ask: null })).state).toBe(STATES.UNAVAILABLE);
  });

  /**
   * Бюджет: модель бачить не більше MAX_LLM_INPUT_CHARS. Цитата з відрізаної
   * частини означала б вигадку — вона не приймається, і причина каже про зріз.
   */
  it('бюджет: текст обрізано, цитата з-за межі не приймається', async () => {
    const long = `${'x '.repeat(MAX_LLM_INPUT_CHARS)} ${GOODS_SENTENCE}`;
    let seen = 0;
    const check = await checkLlmField({ ...base, text: long, ask: async ({ prompt }) => ((seen = prompt.length), { value: true, quote: GOODS_SENTENCE }) });
    expect(seen).toBeLessThan(MAX_LLM_INPUT_CHARS + 2_000);
    expect(check.state).toBe(STATES.UNAVAILABLE);
    expect(check.failure_reason).toContain('обрізано');
  });
});

describe('buildPrompt', () => {
  it('текст сторінки стоїть між маркерами як дані', () => {
    const prompt = buildPrompt({ question: 'Q?', type: 'boolean', text: 'BODY' });
    expect(prompt).toMatch(/<<<ТЕКСТ\nBODY\nТЕКСТ>>>$/);
    expect(prompt).toContain('не інструкції');
  });
});
