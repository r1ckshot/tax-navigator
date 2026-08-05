import { describe, expect, it } from 'vitest';
import { calcJdg } from '../scenarios/jdg';
import { calcUop } from '../scenarios/uop';
import { calcZlecenie } from '../scenarios/zlecenie';
import { withAnswers } from './fixtures';
import type { Answers, SubformId } from '../types';

/**
 * Ворота G2 — десять еталонних профілів.
 *
 * Два різні еталони, і межа між ними принципова:
 *  - **складки** звірені з ДЕРЖАВНИМ калькулятором ZUS (`zus-state.test.ts`);
 *  - **PIT** виведений вручну з норми, бо держкалькулятора для нього більше не
 *    існує (`podatki.gov.pl` лишив тільки taryfowy/odsetek/walut).
 *
 * Кожне число тут пораховане ОКРЕМИМ скриптом, не викликом `calcJdg`, і в назві
 * тесту стоять проміжні величини — щоб наступний рефактор не зсунув їх тихо.
 * Звірка з центром смуги: смуга ±4% — продуктове рішення, не допуск.
 *
 * P9 (nierejestrowana рівно на ліміті 3,604.50 zł/міс) свідомо лишається в
 * `benchmark.test.ts` разом з рештою свого сценарію — дублювати його сюди
 * означало б тримати один еталон у двох місцях.
 *
 * Порядок дій у кожному виводі — за нормою:
 *   ричалт (art. 6 ust. 1 ustawy o ryczałcie): податок 12% від ПРИХОДУ, мінус
 *     половина zdrowotnej з бази; витрати базу не зменшують;
 *   лінійний (art. 30c ustawy o PIT): 19% від доходу, zdrowotna 4.9% доходу,
 *     віднімається до 14,100 zł/рік;
 *   скаля (art. 27 ust. 1): 12% до 120,000 і 32% понад, kwota zmniejszająca
 *     3,600 раз на рік; zdrowotna 9% доходу і від податку НЕ віднімається.
 */

const exact = (r: { min: number; max: number }) => (r.min + r.max) / 2;

function sub(answers: Answers, id: SubformId): number {
  const found = calcJdg(answers).subforms!.find((s) => s.id === id)!;
  return exact(found.rangeMonthly!);
}

/** P1 — медіанний профіль анкети. Закріплений ще до воріт, тут стоїть як опора. */
describe('P1 — 15,000 zł, duży ZUS 1,926.76, programming, витрати <10%', () => {
  const p1 = withAnswers({});

  it('ричалт: zdrowotna 830.58 (ярус 60k–300k), витрати 750, податок 1,750.17 → 9,742.49', () => {
    expect(sub(p1, 'ryczalt')).toBeCloseTo(9742.49, 2);
  });

  it('лінійний: дохід 12,323.24, zdrowotna 603.84, податок 19% × 11,148.24 = 2,226.68 → 9,492.72', () => {
    expect(sub(p1, 'liniowy')).toBeCloseTo(9492.72, 2);
  });

  it('скаля: річний дохід 147,878.88 > 120,000 → 32% на надлишок; zdrowotna 1,109.09 → 9,570.71', () => {
    expect(sub(p1, 'skala')).toBeCloseTo(9570.71, 2);
  });
});

/**
 * P2 — перші 6 місяців діяльності. Тут перевіряється не арифметика, а ГІЛКА:
 * ulga na start (art. 18 Prawa przedsiębiorców) знімає społeczne цілком, лишаючи
 * саму zdrowotną. Складки duży ZUS у формулі не беруть участі взагалі.
 */
describe('P2 — 15,000 zł, ulga na start: społeczne = 0', () => {
  const p2 = withAnswers({ jdgStatus: 'lt6', hadJdgInLast60Months: false });

  it('ричалт: та сама zdrowotna 830.58, але без 1,926.76 ZUS → 11,669.25', () => {
    expect(sub(p2, 'ryczalt')).toBeCloseTo(11669.25, 2);
  });

  it('лінійний: дохід 14,250 (ZUS не віднімається), zdrowotna 698.25 → 10,976.92', () => {
    expect(sub(p2, 'liniowy')).toBeCloseTo(10976.92, 2);
  });

  it('скаля: дохід 14,250, річний 171,000; zdrowotna 1,282.50 → 10,707.50', () => {
    expect(sub(p2, 'skala')).toBeCloseTo(10707.5, 2);
  });

  it('різниця з P1 у ричалті — рівно duży ZUS, 1,926.76', () => {
    expect(sub(p2, 'ryczalt') - sub(withAnswers({}), 'ryczalt')).toBeCloseTo(1926.76, 2);
  });
});

/**
 * P3 — місяці 7–30. Preferencyjny ZUS: база 1,441.80 (30% мінімалки 4,806),
 * складка 456.18 з добровільною хворобовою і 420.86 без. Обидві гілки нижче.
 */
describe('P3 — 12,000 zł, preferencyjny ZUS', () => {
  const p3 = withAnswers({ monthlyRevenue: 12000, jdgStatus: 'from6to30', hadJdgInLast60Months: false });

  it('ричалт із хворобовою (456.18): прихід 144k → ярус 830.58, витрати 600 → 8,723.07', () => {
    expect(sub(p3, 'ryczalt')).toBeCloseTo(8723.07, 2);
  });

  it('без хворобової складка 420.86, тобто на 35.32 менше — рівно на цю суму більше на руки', () => {
    const withoutSickness = sub(withAnswers({ ...p3, voluntarySickness: false }), 'ryczalt');
    expect(withoutSickness - sub(p3, 'ryczalt')).toBeCloseTo(35.32, 2);
  });

  it('лінійний: дохід 10,943.82, zdrowotna 536.25 → 8,430.13', () => {
    expect(sub(p3, 'liniowy')).toBeCloseTo(8430.13, 2);
  });

  it('скаля: річний дохід 131,325.84 → 32% на надлишок; zdrowotna 984.94 → 8,756.85', () => {
    expect(sub(p3, 'skala')).toBeCloseTo(8756.85, 2);
  });
});

/**
 * P4 — zbieg tytułów. Паралельний етат ≥ мінімалки знімає społeczne з JDG
 * повністю, тому числа мусять збігтися з P2 до копійки, хоча підстава інша.
 * Саме цей збіг і є перевіркою: дві різні гілки `assessZus` дають один нуль.
 */
describe('P4 — 15,000 zł, паралельний етат (zbieg)', () => {
  const p4 = withAnswers({ hasParallelUop: true });

  it('ричалт: społeczne = 0 → 11,669.25', () => {
    expect(sub(p4, 'ryczalt')).toBeCloseTo(11669.25, 2);
  });

  it('усі три підформи збігаються з ulga na start — підстава інша, нуль той самий', () => {
    const ulga = withAnswers({ jdgStatus: 'lt6', hadJdgInLast60Months: false });
    for (const id of ['ryczalt', 'liniowy', 'skala'] as SubformId[]) {
      expect(sub(p4, id)).toBeCloseTo(sub(ulga, id), 2);
    }
  });
});

/**
 * P5 — низький дохід. Тут вмикаються ДВА пороги, яких не видно на медіані:
 * мінімальна складка zdrowotna (432.54 — 9% від мінімалки 4,806, з лютого 2026)
 * і kwota zmniejszająca, через яку скаля обганяє обидві інші форми.
 */
describe('P5 — 6,000 zł, duży ZUS: пороги низького доходу', () => {
  const p5 = withAnswers({ monthlyRevenue: 6000 });

  it('ричалт: прихід 72k → ярус 830.58 (ще не найнижчий), витрати 300 → 2,272.49', () => {
    expect(sub(p5, 'ryczalt')).toBeCloseTo(2272.49, 2);
  });

  it('лінійний: 4.9% від доходу 3,773.24 = 184.89 < мінімуму, тож zdrowotna 432.54 → 2,705.97', () => {
    expect(sub(p5, 'liniowy')).toBeCloseTo(2705.97, 2);
  });

  it('скаля: 9% від доходу = 339.59 < мінімуму → теж 432.54; річний податок 1,836.14 → 3,187.91', () => {
    expect(sub(p5, 'skala')).toBeCloseTo(3187.91, 2);
  });

  it('на низькому доході скаля обганяє і лінійний, і ричалт — kwota zmniejszająca 3,600', () => {
    expect(sub(p5, 'skala')).toBeGreaterThan(sub(p5, 'liniowy'));
    expect(sub(p5, 'skala')).toBeGreaterThan(sub(p5, 'ryczalt'));
  });
});

/**
 * P6 — витрати >30% (анкета читає як 40%). Профіль, заради якого і виявився
 * дефект: до 2026-08-05 ричалт не віднімав фактичних витрат від «на руки», тож
 * показував 10,492.49 замість 4,492.49 і виглядав переможцем саме там, де за
 * нормою програє. Тепер тут закріплений РОЗВОРОТ, який обіцяє EVIDENCE §Сценарій C.
 */
describe('P6 — 15,000 zł, витрати >30%: розворот на користь форм із витратами', () => {
  const p6 = withAnswers({ expenseShare: 'gt30' });

  it('ричалт: витрати 6,000 базу податку не зменшують, але з кишені виходять → 4,492.49', () => {
    expect(sub(p6, 'ryczalt')).toBeCloseTo(4492.49, 2);
  });

  it('лінійний: витрати 6,000, дохід 7,073.24, zdrowotna 432.54 (мінімум) → 5,378.97', () => {
    expect(sub(p6, 'liniowy')).toBeCloseTo(5378.97, 2);
  });

  it('скаля: річний дохід 84,878.88 < 120,000 → лише 12%; zdrowotna 636.59 → 5,887.86', () => {
    expect(sub(p6, 'skala')).toBeCloseTo(5887.86, 2);
  });

  it('при витратах 40% ричалт програє обом — це і є break-even з EVIDENCE ≳15–30%', () => {
    expect(sub(p6, 'ryczalt')).toBeLessThan(sub(p6, 'liniowy'));
    expect(sub(p6, 'ryczalt')).toBeLessThan(sub(p6, 'skala'));
  });

  it('а при витратах <10% ричалт далі виграє — напрям залежності відновлений', () => {
    const lowExpense = withAnswers({});
    expect(sub(lowExpense, 'ryczalt')).toBeGreaterThan(sub(lowExpense, 'liniowy'));
  });
});

/**
 * P7 — третій ярус zdrowotnej. Річний прихід 360,000 > 300,000, тож складка
 * стрибає з 830.58 на 1,495.04. Це найдорожчий поріг у ричалті, і його легко
 * пропустити: у місячному вимірі нічого не змінюється, поріг РІЧНИЙ.
 */
describe('P7 — 30,000 zł: третій ярус zdrowotnej', () => {
  const p7 = withAnswers({ monthlyRevenue: 30000 });

  it('ричалт: прихід 360k > 300k → zdrowotna 1,495.04, податок 3,437.06, витрати 1,500 → 21,567.90', () => {
    expect(sub(p7, 'ryczalt')).toBeCloseTo(21567.9, 2);
  });

  it('лінійний: дохід 26,573.24, zdrowotna 1,302.09; відрахування вперлось у стелю 1,175/міс → 20,445.49', () => {
    expect(sub(p7, 'liniowy')).toBeCloseTo(20445.49, 2);
  });

  it('скаля: zdrowotna 2,391.59, річний дохід 318,878.88 → 17,978.21', () => {
    expect(sub(p7, 'skala')).toBeCloseTo(17978.21, 2);
  });

  // Один грош виручки коштує 624.58 zł на місяць: складка росте на 664.46,
  // з чого 39.87 повертається меншим податком (половина zdrowotnej зменшує базу),
  // і ще грош додає сама виручка. Порівнюється саме РІЗНИЦЯ, бо вона й доводить,
  // що поріг річний: місячні суми по обидва боки майже однакові.
  it('поріг РІЧНИЙ: 25,000/міс (300k) → другий ярус, 25,000.01 → третій, розрив 624.58', () => {
    const atLimit = sub(withAnswers({ monthlyRevenue: 25000 }), 'ryczalt');
    const overLimit = sub(withAnswers({ monthlyRevenue: 25000.01 }), 'ryczalt');
    expect(atLimit - overLimit).toBeCloseTo(624.58, 2);
  });
});

/**
 * P8 — 30-krotność. База emerytalne+rentowe стоїть на 282,600 zł/рік
 * (30 × прогнозована середня 9,420). У JDG складки фіксовані, тож ліміт видно
 * лише на найманих формах — тому профіль перевіряється на UoP і zleceniu.
 */
describe('P8 — 60,000 zł: 30-krotność на найманих формах', () => {
  const p8 = withAnswers({ monthlyRevenue: 60000 });

  it('UoP: pension 31,820.76 + chorobowe 17,640 = społeczne 49,460.76 → на руки 35,348.18', () => {
    expect(exact(calcUop(p8, 'gross').rangeMonthly!)).toBeCloseTo(35348.18, 2);
  });

  it('zlecenie з тими самими складками, але KUP 20% → 38,844.39', () => {
    const kup20 = calcZlecenie(p8, 'gross').subforms!.find((s) => s.id === 'kup20')!;
    expect(exact(kup20.rangeMonthly!)).toBeCloseTo(38844.39, 2);
  });

  it('ліміт справді застосований: społeczne менші за 13.71% від повного брутто', () => {
    // Без ліміту społeczne = 720,000 × 13.71% = 98,712. З лімітом — 49,460.76.
    // Різниця в 49,251.24 на рік не могла б виникнути з округлень.
    const capped = 282600 * (0.0976 + 0.015) + 720000 * 0.0245;
    expect(capped).toBeCloseTo(49460.76, 2);
    expect(capped).toBeLessThan(720000 * 0.1371);
  });

  it('JDG на тій самій виручці: ричалт 46,467.90 — складки фіксовані, ліміт ні до чого', () => {
    expect(sub(p8, 'ryczalt')).toBeCloseTo(46467.9, 2);
  });
});

/**
 * P10 — не-програмістська IT-робота. Ставка ричалту 8.5% замість 12%
 * (art. 12 ust. 1 pkt 5 — вузька підтримка, PKWiU 62.02.30.0), решта формули
 * та сама. Профіль ловить підміну ставки, яку легко не помітити: числа
 * правдоподібні в обох випадках.
 */
describe('P10 — 15,000 zł, workKind = otherIt: ричалт 8.5%', () => {
  const p10 = withAnswers({ workKind: 'otherIt' });

  it('ричалт 8.5%: податок 1,239.70 замість 1,750.17 → 10,252.96', () => {
    expect(sub(p10, 'ryczalt')).toBeCloseTo(10252.96, 2);
  });

  it('лінійний і скаля не залежать від виду роботи — збігаються з P1', () => {
    expect(sub(p10, 'liniowy')).toBeCloseTo(9492.72, 2);
    expect(sub(p10, 'skala')).toBeCloseTo(9570.71, 2);
  });

  // 3.5 п.п. від бази 14,584.71 = 510.46; у копійках виходить 510.47, бо кожен
  // «на руки» округлюється до копійки окремо, а не наприкінці.
  it('різниця з P1 — 3.5 п.п. від бази 14,584.71, тобто 510.47', () => {
    expect(sub(p10, 'ryczalt') - sub(withAnswers({}), 'ryczalt')).toBeCloseTo(510.47, 2);
  });
});
