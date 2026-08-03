import { describe, expect, it } from 'vitest';
import { calcNierejestrowana } from '../scenarios/nierejestrowana';
import { getParams } from '@/lib/rules/types';
import { baseAnswers, withAnswers } from './fixtures';

/**
 * Гілки сценарію H. Він відрізняється від решти тим, що ЧАСТІШЕ показує причину,
 * ніж число: ліміт 10,813.50 zł/квартал відсікає майже весь профіль анкети.
 * Тому недоступність тут — не крайній випадок, а основний шлях, і перевіряється
 * так само прискіпливо, як арифметика.
 */
const eligible = withAnswers({ monthlyRevenue: 3000, jdgStatus: 'none' });
const QUARTERLY_LIMIT = getParams<{ quarterlyLimit: number }>('nierejestrowana.limit').quarterlyLimit;
const MONTHLY_EQUIVALENT = QUARTERLY_LIMIT / 3;

describe('nierejestrowana — ліміт приходу', () => {
  it('ліміт у даних дорівнює 10,813.50 zł/квартал, тобто 3,604.50 zł/міс', () => {
    expect(QUARTERLY_LIMIT).toBe(10813.5);
    expect(MONTHLY_EQUIVALENT).toBeCloseTo(3604.5, 2);
  });

  // Обидва боки межі. Ліміт, перевірений лише знизу, не перевірений узагалі —
  // урок F1, де 30-krotność на базовому профілі просто не вмикалась.
  it('рівно на межі (3,604.50 брутто) — число Є', () => {
    const r = calcNierejestrowana(withAnswers({ ...eligible, monthlyRevenue: 3604.5 }), 'gross');
    expect(r.rangeMonthly).not.toBeNull();
    expect(r.noRangeReasonKey).toBeUndefined();
  });

  it('на копійку вище межі (3,604.51 брутто) — числа НЕМА, названа причина', () => {
    const r = calcNierejestrowana(withAnswers({ ...eligible, monthlyRevenue: 3604.51 }), 'gross');
    expect(r.rangeMonthly).toBeNull();
    expect(r.noRangeReasonKey).toBe('nierejestrowana.overLimit');
  });

  // База порівняння тут така сама, як в UoP і zleceniu: виручка = повний кошт
  // замовника. Тому стеля виручки вища за сам ліміт — на наріст 20.48%.
  it('база «повний кошт замовника»: 4,342 zł виручки ще проходить, 4,343 — вже ні', () => {
    expect(calcNierejestrowana(withAnswers({ ...eligible, monthlyRevenue: 4342 })).rangeMonthly).not.toBeNull();
    expect(calcNierejestrowana(withAnswers({ ...eligible, monthlyRevenue: 4343 })).rangeMonthly).toBeNull();
  });

  it('медіанний профіль анкети (15,000 zł/міс) поза лімітом', () => {
    const r = calcNierejestrowana(withAnswers({ monthlyRevenue: 15000, jdgStatus: 'none' }));
    expect(r.rangeMonthly).toBeNull();
    expect(r.noRangeReasonKey).toBe('nierejestrowana.overLimit');
    expect(r.noteKeys).toContain('nierejestrowana.limitIsQuarterly');
  });

  // Zbieg знімає наріст замовника, тож брутто дорівнює виручці — і стеля
  // виручки падає рівно до самого ліміту. Гілка легко ламається мовчки.
  it('при збігу з етатом стеля виручки падає до самого ліміту (наросту замовника нема)', () => {
    const patch = { ...eligible, hasParallelUop: true };
    expect(calcNierejestrowana(withAnswers({ ...patch, monthlyRevenue: 3604 })).rangeMonthly).not.toBeNull();
    expect(calcNierejestrowana(withAnswers({ ...patch, monthlyRevenue: 4342 })).rangeMonthly).toBeNull();
  });
});

describe('nierejestrowana — умова 60 місяців', () => {
  it('активна JDG закриває форму, і причина саме про 60 місяців, а не про ліміт', () => {
    const r = calcNierejestrowana(withAnswers({ monthlyRevenue: 3000, jdgStatus: 'gt30' }));
    expect(r.rangeMonthly).toBeNull();
    expect(r.noRangeReasonKey).toBe('nierejestrowana.priorBusiness');
    expect(r.noteKeys).toContain('nierejestrowana.lookback60');
  });

  it('JDG у минулі 60 місяців закриває форму навіть без активної діяльності', () => {
    const r = calcNierejestrowana(
      withAnswers({ monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: true })
    );
    expect(r.rangeMonthly).toBeNull();
    expect(r.noRangeReasonKey).toBe('nierejestrowana.priorBusiness');
  });

  it('умова 60 місяців важить більше за ліміт: обидва порушені — причина про статус', () => {
    const r = calcNierejestrowana(baseAnswers); // 15,000 zł + jdgStatus 'gt30'
    expect(r.noRangeReasonKey).toBe('nierejestrowana.priorBusiness');
  });

  it('без JDG і в межах ліміту форма доступна', () => {
    expect(calcNierejestrowana(eligible).rangeMonthly).not.toBeNull();
  });
});

describe('nierejestrowana — примітки, які людина мусить прочитати', () => {
  it('пастка «без реєстрації = без ZUS» названа завжди, у доступному й недоступному стані', () => {
    expect(calcNierejestrowana(eligible).noteKeys).toContain('nierejestrowana.zusOnServices');
    expect(calcNierejestrowana(baseAnswers).noteKeys).toContain('nierejestrowana.zusOnServices');
  });

  it('обмеження для чужинців з 01.06.2025 показується завжди — це аудиторія продукту', () => {
    expect(calcNierejestrowana(eligible).noteKeys).toContain('nierejestrowana.foreignersLimited');
    expect(calcNierejestrowana(baseAnswers).noteKeys).toContain('nierejestrowana.foreignersLimited');
  });

  it('фактичні витрати й відсутність місячних авансів — лише там, де число справді є', () => {
    expect(calcNierejestrowana(eligible).noteKeys).toEqual(
      expect.arrayContaining(['nierejestrowana.actualCostsOnly', 'nierejestrowana.noMonthlyAdvances'])
    );
    expect(calcNierejestrowana(baseAnswers).noteKeys).not.toContain('nierejestrowana.actualCostsOnly');
  });

  it('добровільна хворобова названа обома станами, без приписування вибору', () => {
    expect(calcNierejestrowana(eligible).noteKeys).toContain('nierejestrowana.choroboweIncluded');
    expect(
      calcNierejestrowana(withAnswers({ ...eligible, voluntarySickness: false })).noteKeys
    ).toContain('nierejestrowana.choroboweSkipped');
  });

  it('zbieg згадується тільки при паралельному етаті', () => {
    expect(calcNierejestrowana(withAnswers({ ...eligible, hasParallelUop: true })).noteKeys).toContain(
      'nierejestrowana.zbieg'
    );
    expect(calcNierejestrowana(eligible).noteKeys).not.toContain('nierejestrowana.zbieg');
  });

  // Чесність про незнання: закон говорить про ПОЛЬСЬКУ діяльність, і чи закриває
  // форму активна укр ФОП — не звірено. Примітка каже це прямо, а не мовчить.
  it('активна укр ФОП дає примітку про незвірену невизначеність, а не вирок', () => {
    const withFop = calcNierejestrowana(withAnswers({ ...eligible, hasActiveUaFop: true }));
    expect(withFop.noteKeys).toContain('nierejestrowana.uaFopNotVerified');
    expect(withFop.rangeMonthly).not.toBeNull();
    expect(calcNierejestrowana(eligible).noteKeys).not.toContain('nierejestrowana.uaFopNotVerified');
  });
});

describe('nierejestrowana — ризик і джерела', () => {
  it('жовтий у будь-якому стані: ліміт легко перевищити непомітно', () => {
    for (const answers of [eligible, baseAnswers]) {
      const r = calcNierejestrowana(answers);
      expect(r.risk).toBe('yellow');
      expect(r.riskReasonKey).toBe('risk.nierejestrowana.limitWatch');
    }
  });

  it('джерела є навіть тоді, коли числа немає — інакше причину нічим підперти', () => {
    const blocked = calcNierejestrowana(baseAnswers);
    expect(blocked.rangeMonthly).toBeNull();
    expect(blocked.sources.length).toBeGreaterThan(0);
    expect(blocked.sources.map((s) => s.ruleId)).toContain('nierejestrowana.limit');
  });
});
