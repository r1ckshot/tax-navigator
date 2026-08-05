import { describe, expect, it } from 'vitest';
import { calcJdg } from '../scenarios/jdg';
import { calcUop } from '../scenarios/uop';
import { calcIncubator } from '../scenarios/incubator';
import { calcFop } from '../scenarios/fop';
import { calcZlecenie } from '../scenarios/zlecenie';
import { calcNierejestrowana } from '../scenarios/nierejestrowana';
import { compareScenarios } from '../scenarios';
import { baseAnswers, withAnswers } from './fixtures';

/**
 * Еталон звіряється з ЦЕНТРОМ смуги, а не через `rangeContains`. Смуга ±4% —
 * продуктове рішення («діапазони, не точні суми»), а не допуск для арифметики:
 * при 15,000 zł вона ковтає похибку в чотири сотні злотих на місяць. Знайдено
 * мутаційною перевіркою на `zlecenie` (2026-08-03), де тест із `rangeContains`
 * лишався зеленим при KUP, порахованих від неправильної бази.
 */
const exact = (r: { min: number; max: number }) => (r.min + r.max) / 2;

/**
 * Еталони виведені вручну зі ставок, звірених у docs/EVIDENCE.md §6.
 * Профіль: виручка 15,000 zł/міс, повний ZUS (duży 1,926.76), програмування,
 * витрати <10% (беремо 5%).
 *
 * Це старт шляху до ворота G2 (10/10 профілів проти державних калькуляторів) —
 * тут закріплена арифметика, щоб рефактор не зсунув цифри непомітно.
 */
describe('benchmark — JDG при 15,000 zł/міс', () => {
  const jdg = calcJdg(baseAnswers);
  const sub = (id: string) => jdg.subforms?.find((s) => s.id === id);

  it('ричалт 12%: 15000 − 750 витрат − 1750.17 податку − 830.58 zdrowotnej − 1926.76 ZUS = 9742.49', () => {
    expect(sub('ryczalt')!.rangeMonthly!).toBeDefined();
    expect(exact(sub('ryczalt')!.rangeMonthly!)).toBeCloseTo(9742.49, 2);
  });

  it('лінійний 19%: дохід 12323.24 після витрат і ZUS → на руки 9492.72', () => {
    expect(exact(sub('liniowy')!.rangeMonthly!)).toBeCloseTo(9492.72, 2);
  });

  it('скаля: 32% вмикається, бо річний дохід 147.9k > 120k → на руки 9570.71', () => {
    expect(exact(sub('skala')!.rangeMonthly!)).toBeCloseTo(9570.71, 2);
  });

  it('ричалт вигідніший за лінійний при витратах <10% (як каже EVIDENCE)', () => {
    expect(sub('ryczalt')!.rangeMonthly!.min).toBeGreaterThan(sub('liniowy')!.rangeMonthly!.min);
  });

  // Смуга з калібрувального прикладу EVIDENCE §6. Приклад помічений там як
  // «перераховано движком» — це не зовнішній еталон, а вихід цього ж коду, тож
  // тест ловить лише РОЗХОДЖЕННЯ документа з движком, а не правильність числа.
  // Правильність тримають ручний вивід вище і калькулятор ZUS у `zus-state`.
  it('смуга ричалту збігається з калібрувальною 9,352.79–10,132.19 з EVIDENCE', () => {
    const r = sub('ryczalt')!.rangeMonthly!;
    expect(r.min).toBeCloseTo(9352.79, 2);
    expect(r.max).toBeCloseTo(10132.19, 2);
  });
});

describe('benchmark — UoP', () => {
  it('база «повний кошт роботодавця»: брутто 12450.20 → на руки 8718.53', () => {
    const r = calcUop(baseAnswers, 'employerCost').rangeMonthly!;
    expect(exact(r)).toBeCloseTo(8718.53, 2);
  });

  it('база «брутто» (лише для звірки з EVIDENCE): 15000 брутто → на руки 10016.67', () => {
    const r = calcUop(baseAnswers, 'gross').rangeMonthly!;
    expect(exact(r)).toBeCloseTo(10016.67, 2);
  });

  it('30-krotność обмежує базу emerytalne+rentowe при високій зарплаті', () => {
    // 60,000 брутто/міс = 720,000/рік, але база emerytalne+rentowe стоїть на
    // 282,600. Звідси: pension 31,820.76 + chorobowe 17,640 = społeczne 49,460.76;
    // zdrowotna 60,348.53; PIT 186,012.56 → на руки 35,348.18/міс.
    // Без ліміту społeczne були б ~98,712 і цифра вийшла б суттєво нижчою,
    // тому точний збіг і є доказом, що ліміт застосовано.
    const r = calcUop(withAnswers({ monthlyRevenue: 60000 }), 'gross').rangeMonthly!;
    expect(exact(r)).toBeCloseTo(35348.18, 2);
  });
});

describe('benchmark — інкубатор', () => {
  const inc = calcIncubator(baseAnswers);

  it('KUP 20%: 15000 × (1 − 13.6%) − 324.5 абонемент = 12635.50', () => {
    const kup20 = inc.subforms!.find((s) => s.id === 'kup20')!;
    expect(exact(kup20.rangeMonthly!)).toBeCloseTo(12635.5, 2);
  });

  it('маркується як оцінка і як «без ZUS»', () => {
    expect(inc.noteKeys).toContain('incubator.isEstimate');
    expect(inc.noteKeys).toContain('incubator.noZus');
  });

  it('смуга ширша за арифметичні сценарії, бо джерело саме зве цифру оцінкою', () => {
    const kup20 = inc.subforms!.find((s) => s.id === 'kup20')!.rangeMonthly!;
    const jdgRyczalt = calcJdg(baseAnswers).subforms!.find((s) => s.id === 'ryczalt')!.rangeMonthly!;
    const width = (r: { min: number; max: number }) => (r.max - r.min) / ((r.max + r.min) / 2);
    expect(width(kup20)).toBeGreaterThan(width(jdgRyczalt));
  });
});

/**
 * Еталон виведений вручну з EVIDENCE §Сценарій G, у тому ж порядку дій, що й у
 * законі: прихід → społeczne → KUP від залишку → skala. Проміжні числа лишені в
 * назвах тестів, щоб наступний рефактор не зсунув їх тихо.
 *
 * Спільна база: 15,000 zł = ПОВНИЙ кошт замовника → прихід 12,450.20 zł/міс
 * (÷1.2048), річний 149,402.39; społeczne 13.71% = 20,483.07; база KUP
 * 128,919.32; zdrowotna 9% від неї = 11,602.74.
 */
describe('benchmark — umowa zlecenie при 15,000 zł/міс', () => {
  const z = calcZlecenie(baseAnswers);
  const sub = (id: string) => z.subforms?.find((s) => s.id === id);

  it('KUP 20%: витрати 25,783.86 → дохід 103,135.46 → PIT 8,776.25 → на руки 9,045.03', () => {
    expect(exact(sub('kup20')!.rangeMonthly!)).toBeCloseTo(9045.03, 2);
  });

  it('KUP 50%: витрати 64,459.66 → дохід 64,459.66 → PIT 4,135.16 → на руки 9,431.79', () => {
    expect(exact(sub('kup50')!.rangeMonthly!)).toBeCloseTo(9431.79, 2);
  });

  it('без добровільної хворобової: społeczne 11.26% → на руки 9,293.32', () => {
    const noSickness = calcZlecenie(withAnswers({ voluntarySickness: false }));
    expect(exact(noSickness.subforms!.find((s) => s.id === 'kup20')!.rangeMonthly!)).toBeCloseTo(9293.32, 2);
  });

  // Збіг титулів: społeczne нема ні в працівника, ні в замовника, тому прихід
  // дорівнює всім 15,000 — 15,000 × 12 = 180,000; zdrowotna 16,200; KUP 20% від
  // 180,000 → дохід 144,000, з якого 24,000 за ставкою 32%.
  it('збіг із етатом: тільки zdrowotna → на руки 12,110.00', () => {
    const zbieg = calcZlecenie(withAnswers({ hasParallelUop: true }));
    expect(exact(zbieg.subforms!.find((s) => s.id === 'kup20')!.rangeMonthly!)).toBeCloseTo(12110, 2);
  });

  // 30-krotność обмежує базу emerytalne+rentowe і при zleceniu теж. Профіль той
  // самий, що в UoP-тесті вище (60,000 брутто), тому społeczne мусять зійтись до
  // копійки — 49,460.76 на рік. Без ліміту на руки вийшло б 36,160.20, тобто
  // майже на 2,700 zł/міс менше: розрив свідомо великий, щоб мутація «ліміт
  // знято» не могла лишитись непоміченою.
  it('30-krotność ріже і тут: 60,000 брутто → społeczne 49,460.76 → на руки 38,844.39', () => {
    const rich = calcZlecenie(withAnswers({ monthlyRevenue: 60000 }), 'gross');
    expect(exact(rich.subforms!.find((s) => s.id === 'kup20')!.rangeMonthly!)).toBeCloseTo(38844.39, 2);
  });

  // Порівняння з UoP на ТІЙ САМІЙ базі — це і є сенс сценарію в продукті:
  // складки однакові, різницю дає KUP 20% від приходу проти фіксованих 250 zł/міс.
  it('на руки більше, ніж на UoP при тому самому кошті замовника (KUP 20% проти 250 zł/міс)', () => {
    expect(z.rangeMonthly!.min).toBeGreaterThan(calcUop(baseAnswers).rangeMonthly!.min);
  });
});

/**
 * Еталон виведений вручну з EVIDENCE §Сценарій H, у порядку норми: прихід →
 * społeczne (титул той самий, що при zleceniu — послуги) → фактичні витрати →
 * skala. Рахунок зроблено окремим скриптом, не викликом `calcNierejestrowana`.
 *
 * Профіль інший, ніж у решти сценаріїв, і це вимушено: ліміт 10,813.50 zł/квартал
 * = 3,604.50 zł/міс, тож базові 15,000 у цю форму не влазять за побудовою.
 * Спільна база — 3,000 zł ПОВНОГО кошту замовника → прихід 2,490.04 zł/міс
 * (÷1.2048), річний 29,880.48.
 */
describe('benchmark — działalność nierejestrowana при 3,000 zł/міс', () => {
  const eligible = withAnswers({ monthlyRevenue: 3000, jdgStatus: 'none' });

  it('витрати 1,494.02 → społeczne 4,096.61 → zdrowotna 2,320.55 → PIT 0 → на руки 1,830.77', () => {
    expect(exact(calcNierejestrowana(eligible).rangeMonthly!)).toBeCloseTo(1830.77, 2);
  });

  // Не побічний ефект, а факт продукту: 12% від бази 24,289.84 = 2,914.78, що
  // менше за kwotę zmniejszającą 3,600 → податку немає взагалі. Гілка скалі на
  // цьому профілі не працює, тому нижче два профілі з ДОДАТНИМ податком.
  it('kwota zmniejszająca 3,600 з’їдає весь податок при такому доході', () => {
    const annualTaxable = 29880.48 - 1494.02 - 4096.61;
    expect(annualTaxable * 0.12).toBeLessThan(3600);
  });

  it('без добровільної хворобової: społeczne 3,364.54 → на руки 1,886.29', () => {
    const noSickness = calcNierejestrowana(withAnswers({ ...eligible, voluntarySickness: false }));
    expect(exact(noSickness.rangeMonthly!)).toBeCloseTo(1886.29, 2);
  });

  // Головна відмінність від zlecenia: витрати тут ФАКТИЧНІ, тож відповідь анкети
  // рухає і базу податку, і «на руки». При ричалтових KUP цього не сталося б.
  it('витрати 40% замість 5%: витрати 11,952.19 → на руки 959.26', () => {
    const highExpense = calcNierejestrowana(withAnswers({ ...eligible, expenseShare: 'gt30' }));
    expect(exact(highExpense.rangeMonthly!)).toBeCloseTo(959.26, 2);
  });

  // Zbieg: społeczne нема ні в людини, ні в замовника → прихід = всі 3,000.
  // 36,000 річних, витрати 1,800, база 34,200 → PIT 504 (тут він уже додатний).
  it('збіг із етатом: тільки zdrowotna 3,240 → PIT 504 → на руки 2,538.00', () => {
    const zbieg = calcNierejestrowana(withAnswers({ ...eligible, hasParallelUop: true }));
    expect(exact(zbieg.rangeMonthly!)).toBeCloseTo(2538, 2);
  });

  // Верхня межа ліміту — рівно 10,813.50 за квартал. Профіль узятий від брутто,
  // щоб межа була точною, а не наслідком ділення на 1.2048.
  it('рівно на ліміті (3,604.50 брутто/міс): społeczne 5,930.12 → PIT 619.34 → на руки 2,598.56', () => {
    const atLimit = calcNierejestrowana(withAnswers({ ...eligible, monthlyRevenue: 3604.5 }), 'gross');
    expect(exact(atLimit.rangeMonthly!)).toBeCloseTo(2598.56, 2);
  });
});

describe('ФОП — український бік у гривні, польський без числа', () => {
  const fop = calcFop(baseAnswers);

  // Курс тут не потрібен за побудовою: ЄП і ВЗ — частка доходу, а частка від
  // валюти не залежить. 15,000 × (0.05 + 0.01) = 900.
  it('ЄП 5% + ВЗ 1% = 6% від 15,000 zł → 900 zł/міс', () => {
    expect(fop.foreignBurden!.proportionalRate).toBe(0.06);
    expect(exact(fop.foreignBurden!.proportionalMonthly)).toBeCloseTo(900, 2);
  });

  it('ЄСВ лишається в гривні: 1,902.34 грн/міс, без конвертації (DECISIONS 2026-07-29)', () => {
    expect(fop.foreignBurden!.fixedMonthlyUah).toBe(1902.34);
  });

  it('«на руки» в злотих далі без числа — складки ZUS для zakładu не звірені', () => {
    expect(fop.rangeMonthly).toBeNull();
    expect(fop.risk).toBe('red');
    expect(fop.noteKeys).toContain('fop.plSideNotVerified');
  });

  // Дві величини стоять поруч і НЕ складаються — скласти zł і грн можна лише
  // через курс. Природа в них теж різна, і це видно на зміні виручки.
  it('ЄСВ — фіксована підлога (виручка не впливає), ЄП+ВЗ — пропорційні', () => {
    const richer = calcFop(withAnswers({ monthlyRevenue: 30000 }));
    expect(richer.foreignBurden!.fixedMonthlyUah).toBe(fop.foreignBurden!.fixedMonthlyUah);
    expect(richer.foreignBurden!.proportionalMonthly.min).toBeGreaterThan(
      fop.foreignBurden!.proportionalMonthly.min,
    );
  });
});

describe('порівняння як ціле', () => {
  it('шість сценаріїв у фіксованому порядку, без сортування «за вигодою»', () => {
    expect(compareScenarios(baseAnswers).map((s) => s.id)).toEqual([
      'fop',
      'jdg',
      'incubator',
      'nierejestrowana',
      'zlecenie',
      'uop',
    ]);
  });

  it('кожен сценарій несе джерела для цитати', () => {
    for (const s of compareScenarios(baseAnswers)) {
      expect(s.sources.length).toBeGreaterThan(0);
    }
  });

  it('паралельний етат помітно піднімає JDG (społeczne = 0)', () => {
    const without = calcJdg(baseAnswers).rangeMonthly!;
    const withUop = calcJdg(withAnswers({ hasParallelUop: true })).rangeMonthly!;
    expect(withUop.max).toBeGreaterThan(without.max);
  });
});
