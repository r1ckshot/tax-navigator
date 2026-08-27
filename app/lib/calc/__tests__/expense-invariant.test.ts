import { describe, it, expect } from 'vitest';
import { calcJdg } from '../scenarios/jdg';
import { calcUop } from '../scenarios/uop';
import { calcZlecenie } from '../scenarios/zlecenie';
import { calcIncubator } from '../scenarios/incubator';
import { calcNierejestrowana } from '../scenarios/nierejestrowana';
import { expenseRate } from '../scenarios/shared';
import { baseAnswers, withAnswers } from './fixtures';
import type { Answers, ExpenseShare, Range, SubformId } from '../types';

/**
 * Регресійний кейс до дефекту, знайденого 10.5 через `git bisect run`
 * (перший поганий коміт `b64c464`, фікс `52eb7ea`): ричалт рахував «на руки»
 * від приходу і не віднімав фактичних витрат, тож залежність виходила
 * перевернутою — що більші витрати, то привабливішим виглядав сценарій.
 *
 * Еталонні тести (`benchmark`, `g2-profiles`) цього класу не ловлять: вони
 * фіксують ОДНЕ число на профіль, а дефект живе в ЗАЛЕЖНОСТІ між профілями.
 * Тут перевіряється саме залежність, тому тест переживе будь-яку зміну ставок
 * у `rules.2026.json` — він питає не «скільки», а «чи доходять витрати до
 * кишені взагалі».
 *
 * Відтворення на довільному checkout-і історії —
 * `scripts/repro/ryczalt-expense-invariant.mjs` (той самий предикат, чесний
 * exit-код для `git bisect run`).
 */

const SHARES: ExpenseShare[] = ['lt10', 'from10to30', 'gt30'];

/** Центр смуги: сама смуга ±4% — продуктове рішення, не допуск арифметики. */
const exact = (r: Range) => (r.min + r.max) / 2;

function subformTakeHome(answers: Answers, id: SubformId): number {
  const found = calcJdg(answers).subforms?.find((s) => s.id === id);
  if (!found?.rangeMonthly) throw new Error(`підформа ${id} без смуги — профіль тесту застарів`);
  return exact(found.rangeMonthly);
}

/** Скільки злотих виходить із кишені при переході між смугами витрат. */
function expenseGap(revenue: number, from: ExpenseShare, to: ExpenseShare): number {
  return revenue * (expenseRate(to) - expenseRate(from));
}

describe('JDG: більші витрати ніколи не збільшують «на руки»', () => {
  for (const id of ['ryczalt', 'liniowy', 'skala'] as const) {
    it(`${id}: lt10 > from10to30 > gt30`, () => {
      const [low, mid, high] = SHARES.map((share) => subformTakeHome(withAnswers({ expenseShare: share }), id));
      expect(low).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(high);
    });
  }

  /**
   * Ричалт — найтугіший замок: база податку тут прихід, тож витрати НЕ
   * зменшують ні податку, ні складки, і різниця «на руки» дорівнює самим
   * витратам, до гроша. Саме ця рівність була нулем до `52eb7ea`.
   */
  it('ричалт: різниця «на руки» дорівнює різниці витрат рівно (15,000 zł × 35% = 5,250)', () => {
    const low = subformTakeHome(withAnswers({ expenseShare: 'lt10' }), 'ryczalt');
    const high = subformTakeHome(withAnswers({ expenseShare: 'gt30' }), 'ryczalt');
    expect(low - high).toBeCloseTo(expenseGap(baseAnswers.monthlyRevenue, 'lt10', 'gt30'), 2);
    expect(low - high).toBeCloseTo(5250, 2);
  });

  /**
   * Лінійний і скаля віднімають витрати ще й від бази податку, тож кишеня
   * втрачає МЕНШЕ, ніж самі витрати. Верхня межа тримає протилежну помилку:
   * подвійне віднімання тих самих витрат дало б розрив більший за них.
   */
  for (const id of ['liniowy', 'skala'] as const) {
    it(`${id}: втрата кишені менша за самі витрати, але не нульова`, () => {
      const low = subformTakeHome(withAnswers({ expenseShare: 'lt10' }), id);
      const high = subformTakeHome(withAnswers({ expenseShare: 'gt30' }), id);
      const gap = expenseGap(baseAnswers.monthlyRevenue, 'lt10', 'gt30');
      expect(low - high).toBeGreaterThan(0);
      expect(low - high).toBeLessThan(gap);
    });
  }

  /**
   * Розворот із EVIDENCE §Сценарій C, записаний як залежність, а не як число:
   * при великих витратах ричалт (база — прихід) мусить програвати формам, що
   * витрати віднімають. До фіксу він вигравав саме там.
   */
  it('при витратах >30% ричалт програє і лінійному, і скалі', () => {
    const answers = withAnswers({ expenseShare: 'gt30' });
    const ryczalt = subformTakeHome(answers, 'ryczalt');
    expect(ryczalt).toBeLessThan(subformTakeHome(answers, 'liniowy'));
    expect(ryczalt).toBeLessThan(subformTakeHome(answers, 'skala'));
  });
});

describe('Nierejestrowana: той самий інваріант на другому сценарії, що читає витрати', () => {
  // Ліміт квартальний, і шлях закритий будь-якою JDG у 60-місячному вікні —
  // тому профіль інший, ніж базовий.
  const small = (share: ExpenseShare): Answers =>
    withAnswers({ monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: false, expenseShare: share });

  it('«на руки» спадає з ростом витрат', () => {
    const values = SHARES.map((share) => {
      const range = calcNierejestrowana(small(share)).rangeMonthly;
      if (!range) throw new Error('nierejestrowana недоступна на профілі тесту — профіль застарів');
      return exact(range);
    });
    expect(values[0]).toBeGreaterThan(values[1]);
    expect(values[1]).toBeGreaterThan(values[2]);
  });
});

/**
 * Зворотний бік інваріанта. Ці три сценарії `expenseShare` не читають взагалі,
 * і це навмисно: UoP і zlecenie — не власна діяльність, там витрат людини в
 * моделі немає, а KUP 20/50% — нормативна ставка, не фактичні витрати.
 *
 * Інкубатор рахується з оцінних ефективних ставок PIT і абонплати, тож фактичні
 * витрати в ньому теж не з'являються. Чи має він їх віднімати, як JDG, —
 * ВІДКРИТЕ продуктове питання, а не мовчазний баг: відповідь зсуває показане
 * число, тож іде через `docs/EVIDENCE.md` і рішення Mike, не через правку тесту.
 * Тест замикає поточний контракт: зміна тут має бути свідомою і пройти EVIDENCE.
 */
describe('Сценарії, що витрат не читають — рівно, і причина названа', () => {
  const flat: [string, (a: Answers) => Range | null][] = [
    ['uop', (a) => calcUop(a, 'employerCost').rangeMonthly],
    ['zlecenie', (a) => calcZlecenie(a).rangeMonthly],
    ['incubator', (a) => calcIncubator(a).rangeMonthly],
  ];

  for (const [name, calc] of flat) {
    it(`${name}: смуга однакова на всіх трьох смугах витрат`, () => {
      const values = SHARES.map((share) => {
        const range = calc(withAnswers({ expenseShare: share }));
        if (!range) throw new Error(`${name} без смуги на базовому профілі — профіль застарів`);
        return exact(range);
      });
      expect(values[1]).toBeCloseTo(values[0], 2);
      expect(values[2]).toBeCloseTo(values[0], 2);
    });
  }
});
