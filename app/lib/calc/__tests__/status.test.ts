import { describe, expect, it } from 'vitest';
import { getParams } from '@/lib/rules/types';
import { uk } from '@/lib/i18n/uk';
import { assessStatus, BASIS_TO_RULE_CODE, type Access } from '../status';
import { calcFop } from '../scenarios/fop';
import { calcJdg } from '../scenarios/jdg';
import { calcNierejestrowana } from '../scenarios/nierejestrowana';
import { calcUop } from '../scenarios/uop';
import { calcZlecenie } from '../scenarios/zlecenie';
import { calcIncubator } from '../scenarios/incubator';
import { compareScenarios } from '../scenarios';
import { baseAnswers, withAnswers } from './fixtures';
import type { StayBasis } from '../types';

/**
 * Еталон доступу виведено з текстів законів, не з коду і не з масивів правил
 * (EVIDENCE «Право працювати й вести діяльність»):
 *   бізнес — art. 4 ust. 1–2 ustawy o przedsiębiorcach zagranicznych (п. 2):
 *     ЄС (ust. 1); pobyt stały, rezydent UE, Niebieska Karta (art. 127),
 *     studia (art. 144) — ust. 2 pkt 1; ochrona czasowa — pkt 2; CUKR — art. 42w
 *     specustawy (п. 3); карти на роботу (art. 114) у переліку немає.
 *   праця — ustawa z 20.03.2025 (п. 5): ЄС поза законом (art. 1 ust. 2 pkt 6);
 *     swobodny dostęp — pobyt stały, ochrona czasowa, studia (art. 3 ust. 1),
 *     CUKR (art. 42v); Niebieska Karta і карта на роботу — «w ramach zezwolenia»
 *     (art. 3 ust. 2 pkt 1).
 */
const EXPECTED: Record<Exclude<StayBasis, 'other'>, { business: Access; work: Access }> = {
  eu_citizen: { business: 'allowed', work: 'allowed' },
  ukr: { business: 'allowed', work: 'allowed' },
  cukr: { business: 'allowed', work: 'allowed' },
  permanent: { business: 'allowed', work: 'allowed' },
  study: { business: 'allowed', work: 'allowed' },
  blue_card: { business: 'allowed', work: 'permitBound' },
  work_permit: { business: 'notAllowed', work: 'permitBound' },
};
const BASES = Object.keys(EXPECTED) as Exclude<StayBasis, 'other'>[];

const center = (r: { min: number; max: number } | null) => (r ? (r.min + r.max) / 2 : null);

describe('модель статусу — кожна гілка дозволу', () => {
  it.each(BASES)('%s: бізнес і праця як у законі', (basis) => {
    const s = assessStatus(basis);
    expect(s.forms.jdg.access).toBe(EXPECTED[basis].business);
    expect(s.forms.nierejestrowana.access).toBe(EXPECTED[basis].business);
    for (const id of ['uop', 'zlecenie', 'incubator'] as const) expect(s.forms[id].access).toBe(EXPECTED[basis].work);
  });

  it('кожна форма несе rule_id причини', () => {
    const s = assessStatus('work_permit');
    expect(s.forms.jdg.ruleId).toBe('status.business_right');
    expect(s.forms.nierejestrowana.ruleId).toBe('status.business_right');
    expect(s.forms.uop.ruleId).toBe('status.work_right');
    expect(s.forms.incubator.ruleId).toBe('status.work_right');
  });

  it('«інша підстава», порожня і зіпсована відповідь — невідомо, а не «можна»', () => {
    for (const basis of ['other', undefined, 'visa'] as (StayBasis | undefined)[]) {
      const s = assessStatus(basis);
      expect(s.forms.jdg.access).toBe('unknown');
      expect(s.forms.uop.access).toBe('unknown');
    }
  });

  // Анкета зводить три коди закону в один варіант — це чесно, лише поки в обох
  // правилах вони стоять в одних і тих самих списках.
  it('«постійне перебування» = pobyt stały, rezydent UE і Karta Polaka: доступ однаковий', () => {
    const business = getParams<{ equalToPolesBases: string[] }>('status.business_right');
    const work = getParams<{ freeAccessBases: string[]; permitBoundBases: string[] }>('status.work_right');
    expect(BASIS_TO_RULE_CODE.permanent).toBe('permanent_residence');
    for (const code of ['permanent_residence', 'eu_long_term_resident', 'karta_polaka']) {
      expect(business.equalToPolesBases).toContain(code);
      expect(work.freeAccessBases).toContain(code);
    }
  });

  it('країна — параметр інтерфейсу, дані лише PL', () => {
    expect(assessStatus('ukr', 'PL').country).toBe('PL');
  });

  // PRD AC-3, AC-5: UKR і CUKR — різні відповіді; строк лише в UKR і з правила.
  it('UKR несе строк захисту з правила, CUKR — ні', () => {
    const until = getParams<{ protectionUntil: string }>('status.ukr_protection').protectionUntil;
    expect(assessStatus('ukr').protection?.until).toBe(until);
    expect(assessStatus('cukr').protection).toBeUndefined();
  });
});

describe('форма без права — причина і джерело замість числа (PRD AC-1)', () => {
  it('карта на роботу: JDG без числа, без підформ, високий ризик, джерело — перелік закону', () => {
    const jdg = calcJdg(withAnswers({ stayBasis: 'work_permit' }));
    expect(jdg.rangeMonthly).toBeNull();
    expect(jdg.subforms).toBeUndefined();
    expect(jdg.noRangeReasonKey).toBe('status.business.notAllowed');
    expect(jdg.risk).toBe('red');
    expect(jdg.riskReasonKey).toBe('risk.status.business.notAllowed');
    expect(jdg.sources[0].ruleId).toBe('status.business_right');
  });

  it('карта на роботу: nierejestrowana без числа ще до ліміту й 60 місяців', () => {
    // Профіль, з яким nierejestrowana інакше мала б число (див. nierejestrowana.test).
    const r = calcNierejestrowana(
      withAnswers({ stayBasis: 'work_permit', monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: false })
    );
    expect(r.rangeMonthly).toBeNull();
    expect(r.noRangeReasonKey).toBe('status.business.notAllowed');
    expect(r.sources.map((s) => s.ruleId)).toEqual(['status.business_right', 'nierejestrowana.cudzoziemcy']);
  });

  it('невідома підстава: без числа, середній ризик, своя причина', () => {
    const jdg = calcJdg(withAnswers({ stayBasis: 'other' }));
    expect(jdg.rangeMonthly).toBeNull();
    expect(jdg.risk).toBe('yellow');
    expect(jdg.noRangeReasonKey).toBe('status.business.unknown');
  });

  it('форма не ховається: у порівнянні завжди шість рядків', () => {
    expect(compareScenarios(withAnswers({ stayBasis: 'work_permit' })).map((s) => s.id)).toEqual([
      'fop',
      'jdg',
      'incubator',
      'nierejestrowana',
      'zlecenie',
      'uop',
    ]);
  });

  // АНТИ-РЕГРЕС: число в JDG чи nierejestrowanej без права — саме та помилка,
  // заради якої тема 1.3 існує (карта на роботу бачила JDG як варіант).
  it.each([...BASES, 'other' as const])('АНТИ-РЕГРЕС %s: форма без права не показує числа ніде', (basis) => {
    const answers = withAnswers({ stayBasis: basis, monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: false });
    const allowed = assessStatus(basis).forms.jdg.access === 'allowed';
    for (const r of [calcJdg(answers), calcNierejestrowana(answers)]) {
      const anyNumber = r.rangeMonthly !== null || (r.subforms ?? []).some((s) => s.rangeMonthly !== null);
      expect(anyNumber, r.id).toBe(allowed);
    }
  });
});

describe('статус не зсуває жодного числа там, де форма дозволена', () => {
  // Еталони G2 і benchmark рахуються з UKR; будь-яка інша дозволена підстава
  // мусить дати той самий центр смуги — право впливає на доступ, не на арифметику.
  const ref = {
    jdg: center(calcJdg(baseAnswers).rangeMonthly),
    uop: center(calcUop(baseAnswers).rangeMonthly),
    zlecenie: center(calcZlecenie(baseAnswers).rangeMonthly),
    incubator: center(calcIncubator(baseAnswers).rangeMonthly),
  };

  it.each(BASES)('%s: числа найму ті самі, що з UKR', (basis) => {
    const a = withAnswers({ stayBasis: basis });
    expect(center(calcUop(a).rangeMonthly)).toBe(ref.uop);
    expect(center(calcZlecenie(a).rangeMonthly)).toBe(ref.zlecenie);
    expect(center(calcIncubator(a).rangeMonthly)).toBe(ref.incubator);
  });

  it.each(BASES.filter((b) => EXPECTED[b].business === 'allowed'))('%s: JDG те саме число, що з UKR', (basis) => {
    expect(center(calcJdg(withAnswers({ stayBasis: basis })).rangeMonthly)).toBe(ref.jdg);
  });
});

describe('примітки про право на працю (PRD AC-2)', () => {
  const keysOf = (basis: StayBasis) => {
    const a = withAnswers({ stayBasis: basis });
    return [calcUop(a), calcZlecenie(a), calcIncubator(a)].map((r) => r.noteKeys);
  };

  it.each(['work_permit', 'blue_card'] as const)('%s: «лише в межах дозволу» у трьох формах найму', (basis) => {
    for (const keys of keysOf(basis)) expect(keys).toContain('status.work.permitBound');
  });

  it.each(['eu_citizen', 'ukr', 'cukr', 'permanent', 'study'] as const)('%s: вільний доступ — без примітки', (basis) => {
    for (const keys of keysOf(basis)) {
      expect(keys).not.toContain('status.work.permitBound');
      expect(keys).not.toContain('status.work.unknown');
    }
  });

  it('невідома підстава — примітка «залежить від підстави»', () => {
    for (const keys of keysOf('other')) expect(keys).toContain('status.work.unknown');
  });
});

describe('строк захисту на екрані — з правила, не з тексту (PRD AC-3, AC-5)', () => {
  const until = getParams<{ protectionUntil: string; lostWhenAbroadDaysOver: number }>('status.ukr_protection');

  it('UKR: JDG і nierejestrowana несуть примітку і дату з status.ukr_protection', () => {
    const a = withAnswers({ stayBasis: 'ukr', monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: false });
    for (const r of [calcJdg(a), calcNierejestrowana(a)]) {
      expect(r.noteKeys).toContain('status.ukrProtection');
      expect(r.noteVars?.protectionUntil).toBe(until.protectionUntil);
      expect(r.noteVars?.abroadDays).toBe(String(until.lostWhenAbroadDaysOver));
      expect(r.sources.map((s) => s.ruleId)).toContain('status.ukr_protection');
    }
  });

  it('UKR: примітка про строк захисту є на всіх п\'яти формах, де право тримається на захисті', () => {
    const a = withAnswers({ stayBasis: 'ukr', monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: false });
    for (const r of [calcUop(a), calcZlecenie(a), calcIncubator(a)]) {
      expect(r.noteKeys).toContain('status.ukrProtection');
      expect(r.noteVars?.protectionUntil).toBe(until.protectionUntil);
      expect(r.sources.map((s) => s.ruleId)).toContain('status.ukr_protection');
    }
    // Український ФОП стоїть на праві України, а не на польському захисті.
    expect(calcFop(a).noteKeys).not.toContain('status.ukrProtection');
  });

  it('CUKR: ні UoP, ні zlecenie, ні інкубатор примітки про захист не несуть', () => {
    const a = withAnswers({ stayBasis: 'cukr' });
    for (const r of [calcUop(a), calcZlecenie(a), calcIncubator(a)]) {
      expect(r.noteKeys).not.toContain('status.ukrProtection');
    }
  });

  it('CUKR: примітки про строк захисту немає', () => {
    const a = withAnswers({ stayBasis: 'cukr' });
    expect(calcJdg(a).noteKeys).not.toContain('status.ukrProtection');
    expect(calcNierejestrowana(a).noteKeys).not.toContain('status.ukrProtection');
  });

  it('АНТИ-РЕГРЕС: у тексті немає літерала дати — лише змінні', () => {
    for (const key of ['status.ukrProtection', 'risk.jdg.singleClient', 'risk.jdg.standard']) {
      expect(uk[key], key).not.toMatch(/\d{4}/);
    }
    expect(uk['status.ukrProtection']).toContain('{protectionUntil}');
  });

  it('АНТИ-РЕГРЕС: дати в картках zlecenie і nierejestrowanej йдуть з правил, не з тексту', () => {
    for (const key of ['risk.zlecenie.reclassification', 'nierejestrowana.foreignersLimited']) {
      expect(uk[key], key).not.toMatch(/\d{4}/);
    }
    const pipFrom = getParams<{ pipDecisionPowerFrom: string }>('zlecenie.przekwalifikowanie').pipDecisionPowerFrom;
    expect(calcZlecenie(withAnswers({})).noteVars?.pipFrom).toBe(pipFrom);
    const from = getParams<{ restrictedFrom: string }>('nierejestrowana.cudzoziemcy').restrictedFrom;
    const n = calcNierejestrowana(withAnswers({ monthlyRevenue: 3000, jdgStatus: 'none', hadJdgInLast60Months: false }));
    expect(n.noteVars?.foreignersFrom).toBe(from);
    expect(uk['status.ukrProtection']).toContain('{abroadDays}');
  });

  it('громадянин ЄС: примітки про обмеження для чужинців у nierejestrowanej немає', () => {
    const a = { monthlyRevenue: 3000, jdgStatus: 'none' as const, hadJdgInLast60Months: false };
    expect(calcNierejestrowana(withAnswers({ ...a, stayBasis: 'eu_citizen' })).noteKeys).not.toContain(
      'nierejestrowana.foreignersLimited'
    );
    expect(calcNierejestrowana(withAnswers({ ...a, stayBasis: 'ukr' })).noteKeys).toContain(
      'nierejestrowana.foreignersLimited'
    );
  });
});

describe('ризик B2B для JDG з 08.07.2026 (PRD AC-4)', () => {
  const pipFrom = getParams<{ pipDecisionPowerFrom: string }>('jdg.przekwalifikowanie').pipDecisionPowerFrom;

  it('один замовник — середній ризик і текст про PIP', () => {
    const r = calcJdg(withAnswers({ clientCount: 'one' }));
    expect(r.risk).toBe('yellow');
    expect(r.riskReasonKey).toBe('risk.jdg.singleClient');
    expect(r.noteVars?.pipFrom).toBe(pipFrom);
    expect(r.sources.map((s) => s.ruleId)).toContain('jdg.przekwalifikowanie');
  });

  it('кілька замовників — низький ризик, але текст усе одно про PIP, не «без обмежень»', () => {
    const r = calcJdg(withAnswers({ clientCount: 'several' }));
    expect(r.risk).toBe('green');
    expect(r.riskReasonKey).toBe('risk.jdg.standard');
    expect(uk['risk.jdg.standard']).toContain('{pipFrom}');
    expect(uk['risk.jdg.standard']).not.toMatch(/без додаткових обмежень/);
  });

  it('без відповіді (старе посилання) — обережно, як з одним', () => {
    const r = calcJdg(withAnswers({ clientCount: undefined }));
    expect(r.risk).toBe('yellow');
    expect(r.riskReasonKey).toBe('risk.jdg.singleClient');
  });

  it('колишній роботодавець лишається головною причиною, PIP — у примітках', () => {
    const r = calcJdg(withAnswers({ formerEmployer: 'partial', clientCount: 'one' }));
    expect(r.risk).toBe('yellow');
    expect(r.riskReasonKey).toBe('risk.jdg.formerEmployer.partial');
    expect(r.noteKeys[0]).toBe('risk.jdg.singleClient');
  });

  // Закон кількості замовників не називає (EVIDENCE п. 7) — текст не сміє казати інакше.
  it('текст не прирівнює одного замовника до перекваліфікації', () => {
    expect(uk['risk.jdg.singleClient']).toMatch(/Кількості замовників закон не називає/);
    expect(uk['risk.jdg.singleClient']).toMatch(/припис/);
    expect(uk['risk.jdg.singleClient']).toMatch(/art\. 22 § 1/);
  });
});

describe('числа в прозі збігаються з правилами (evidence-numbers: похідні звіряти тестом)', () => {
  // Текст лишається прозою, тож змінна не підставляється, але зсув правила без
  // правки тексту червоніє тут. Пробіли нормалізовано: у `uk.ts` розряди можуть бути нерозривними.
  const text = (key: string) => uk[key].replace(/\s/g, ' ');
  const ru = (n: number) => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  const pct = (x: number) => `${String(+(x * 100).toFixed(2)).replace('.', ',')}%`;

  it('хворобовий внесок — chorobowe з правил zlecenie.contributions', () => {
    const chorobowe = getParams<{ employee: { chorobowe: number } }>('zlecenie.contributions').employee.chorobowe;
    for (const key of ['zlecenie.choroboweIncluded', 'zlecenie.choroboweSkipped', 'nierejestrowana.choroboweIncluded', 'nierejestrowana.choroboweSkipped']) {
      expect(text(key), key).toContain(pct(chorobowe));
    }
  });

  it('ліміт KUP 50% — copyrightAnnualCap з правил', () => {
    const cap = getParams<{ copyrightAnnualCap: number }>('zlecenie.kup').copyrightAnnualCap;
    expect(getParams<{ copyrightAnnualCap: number }>('incubator.kup').copyrightAnnualCap).toBe(cap);
    for (const key of ['zlecenie.copyrightCapExceeded', 'incubator.copyrightCapExceeded']) {
      expect(text(key), key).toContain(`${ru(cap)} zł`);
    }
  });

  it('ліміт nierejestrowanej і строк реєстрації — з nierejestrowana.limit і zlecenie.zbieg_z_etatem', () => {
    const limit = getParams<{ quarterlyLimit: number; shareOfMinimumWage: number; daysToRegisterAfterExceeding: number }>('nierejestrowana.limit');
    const wage = getParams<{ minimumWageMonthly: number }>('zlecenie.zbieg_z_etatem').minimumWageMonthly;
    const limitText = text('nierejestrowana.limitIsQuarterly');
    // Копійки в тексті завжди двома знаками: «10 813,50», а не «10 813,5».
    expect(limitText).toContain(`${ru(Math.floor(limit.quarterlyLimit))},${limit.quarterlyLimit.toFixed(2).split('.')[1]} zł`);
    expect(limitText).toContain(`${Math.round(limit.shareOfMinimumWage * 100)}%`);
    expect(limitText).toContain(`${ru(wage)} zł`);
    expect(text('risk.nierejestrowana.limitWatch')).toContain(`${limit.daysToRegisterAfterExceeding} днів`);
  });
});
