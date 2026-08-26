import { describe, it, expect } from 'vitest';
import { verdict, GOOD, BAD, SKIP } from './ryczalt-expense-invariant.mjs';

/**
 * Предикат repro-скрипта під `git bisect run`. Тестується сама логіка вердикту,
 * без запуску vitest у vitest: помилка тут веде bisect не туди тихо, а це
 * найдорожчий різновид червоного — той самий клас, що зламаний парсер судді
 * в `evals/judge.py` (10.3).
 */
describe('repro-предикат: витрати проти «на руки»', () => {
  const expectedDelta = 5250;

  it('витрати доходять до кишені — good (0)', () => {
    expect(verdict({ lt10: 9742.49, gt30: 4492.49, expectedDelta }).code).toBe(GOOD);
  });

  it('«на руки» не змінилось узагалі — bad (1), це і є дефект b64c464', () => {
    expect(verdict({ lt10: 10492.49, gt30: 10492.49, expectedDelta }).code).toBe(BAD);
  });

  it('часткове віднімання — skip (125), а не здогадка', () => {
    expect(verdict({ lt10: 10000, gt30: 8000, expectedDelta }).code).toBe(SKIP);
  });

  it('зонд без чисел — skip, бо checkout нічого не сказав', () => {
    expect(verdict({ lt10: null, gt30: null, expectedDelta }).code).toBe(SKIP);
  });

  it('смуги витрат не відрізняються — skip, предикат неперевірний', () => {
    expect(verdict({ lt10: 9742.49, gt30: 9742.49, expectedDelta: 0 }).code).toBe(SKIP);
  });

  it('допуск — грош, не злотий: 0.99 zł різниці ще читається як bad', () => {
    expect(verdict({ lt10: 10492.49, gt30: 10491.5, expectedDelta }).code).toBe(BAD);
  });
});
