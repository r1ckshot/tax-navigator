import { describe, expect, it } from 'vitest';
import { RULES, getParams } from '@/lib/rules/types';

const STALE_AFTER_DAYS = 180;

const daysSince = (isoDate: string) =>
  (Date.now() - Date.parse(`${isoDate}T00:00:00Z`)) / 86_400_000;

describe('rules-as-data — дисципліна джерел', () => {
  it('кожне правило має source_url і verified_at', () => {
    for (const rule of RULES.rules) {
      expect(rule.source_url, rule.rule_id).toMatch(/^https?:\/\//);
      expect(rule.verified_at, rule.rule_id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  // Анти-регрес: sip.lex.pl — комерційна база за пейволом, і посилання на неї
  // тримало два правила ryczałtu на art. 8 ust. 1 pkt 6, який уже uchylony
  // (перезвірка 2026-10-01, EVIDENCE). Джерело для людини — державне: сторінка
  // podatki/zus/biznes.gov.pl або текст закону в ISAP/ELI.
  it('жодне правило не посилається на комерційну базу', () => {
    for (const rule of RULES.rules) {
      expect(new URL(rule.source_url).hostname, rule.rule_id).not.toMatch(/(^|\.)lex\.pl$/);
    }
  });

  it('rule_id унікальні', () => {
    const ids = RULES.rules.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('податковий рік зафіксований на 2026', () => {
    expect(RULES.tax_year).toBe(2026);
  });

  // Тригер для /scaffold-rule: репо саме каже, що перезвіряти, бо ззовні змін
  // ніхто не моніторить. Тест свідомо падає від самого плину часу, без зміни
  // коду — для продукту, який показує verified_at користувачу, протерміноване
  // число і є дефект. Календар польських цифр: обвіщення GUS і ліміти PIT —
  // грудень, бази ZUS — з 1 січня; 180 днів від липневої звірки влучають туди.
  it(`жодне правило не старше ${STALE_AFTER_DAYS} днів`, () => {
    const stale = RULES.rules
      .filter((r) => daysSince(r.verified_at) > STALE_AFTER_DAYS)
      .map((r) => `${r.rule_id} (${r.verified_at})`);
    expect(stale, 'перезвірити командою /scaffold-rule <rule_id>').toEqual([]);
  });
});

describe('verify-first числа не дрейфнули', () => {
  it('składka zdrowotna для ричалту — чинні пороги Polskiego Ładu', () => {
    const z = getParams<{ tiers: { monthly: number }[] }>('jdg.zdrowotna.ryczalt');
    expect(z.tiers.map((t) => t.monthly)).toEqual([498.35, 830.58, 1495.04]);
  });

  // STATE.md попереджає: у мережі гуляють цифри з ВЕТОВАНОЇ реформи 2025.
  // Якщо вони колись потраплять у дані — цей тест має впасти.
  it('АНТИ-РЕГРЕС: цифри ветованої реформи не потрапили в дані', () => {
    const serialized = JSON.stringify(RULES);
    for (const vetoed of [376.16, 626.93, 1128.48]) {
      expect(serialized).not.toContain(String(vetoed));
    }
  });

  it('етапи ZUS 2026', () => {
    const s = getParams<Record<string, number>>('jdg.zus.stages');
    expect(s.preferencyjnyWithSickness).toBe(456.18);
    expect(s.preferencyjnyWithoutSickness).toBe(420.86);
    expect(s.duzyMonthly).toBe(1926.76);
  });

  it('sunset спецнорми art. 52zr — 31.12.2026', () => {
    expect(getParams<{ validTo: string }>('residency.special_norm_52zr').validTo).toBe('2026-12-31');
  });

  // Kwota wolna не стоїть на жодній сторінці автозвірки дослівно: її тримає ця
  // звірка, а не сторінка (`scripts/rules-change-monitor/pages.mjs`, `derived`).
  it('внутрішня звірка: kwota wolna 30 000 = kwota zmniejszająca 3 600 / нижча ставка 12%', () => {
    const skala = getParams<{ lowerRate: number; taxFreeAmount: number; kwotaZmniejszajacaAnnual: number }>('jdg.skala');
    expect(skala.taxFreeAmount).toBeCloseTo(skala.kwotaZmniejszajacaAnnual / skala.lowerRate, 6);
  });

  // Анти-регрес: «ефективні ставки» інкубатора (13,6% і 6%) прибрано 2026-10-01 —
  // перша була ставкою шкали до 2022 року (17% × 0,8). PIT інкубатора рахує
  // `skalaAnnualTax` зі звірених ставок, тож збережена оцінка не має повернутись.
  it('інкубатор не несе збереженої «ефективної ставки» PIT', () => {
    const params = getParams<Record<string, unknown>>('incubator.kup');
    expect(Object.keys(params).filter((k) => /effectivePit/i.test(k))).toEqual([]);
  });

  // Анти-дрейф: межі смуги — ціни самих інкубаторів, звірені 2026-10-01 (EVIDENCE,
  // сценарій E): нижня — Bizky Prime «Miesięczny Koszt Podstawowy 349 zł», верхня —
  // FBA.ink «500 PLN per month». Пастка — акція FBA «Instead of 500 zł only 350 zł»
  // на старт і старе 300 без джерела: жодне з них не межа смуги.
  it('абонемент інкубатора 349–500 zł/міс: Bizky Prime і FBA.ink, без стартової акції', () => {
    const p = getParams<{ subscriptionMonthlyMin: number; subscriptionMonthlyMax: number }>('incubator.kup');
    expect([p.subscriptionMonthlyMin, p.subscriptionMonthlyMax]).toEqual([349, 500]);
    expect([300, 350]).not.toContain(p.subscriptionMonthlyMin);
  });

  it('внутрішня звірка: 30-krotność = 30 × прогнозована середня, що дає базу duży ZUS', () => {
    const avg = getParams<{ monthly: number }>('common.projected_average_wage').monthly;
    const cap = getParams<{ annualBaseCap: number }>('uop.annual_contribution_cap').annualBaseCap;
    const duzyBase = getParams<{ duzyBase: number }>('jdg.zus.stages').duzyBase;
    expect(cap).toBe(avg * 30);
    expect(duzyBase).toBeCloseTo(avg * 0.6, 0);
  });

  it('ЄСВ укр ФОП 2026: мінімум 1902.34 грн/міс = 22% × мінімалка 8647 грн (ст. 8 Держбюджету-2026)', () => {
    const p = getParams<{
      esvRate: number;
      minimumWageMonthlyUah: number;
      esvMinMonthlyUah: number;
    }>('fop.esv_vz');
    expect(p.esvRate).toBe(0.22);
    expect(p.minimumWageMonthlyUah).toBe(8647);
    expect(p.esvMinMonthlyUah).toBe(1902.34);
    // крос-звірка похідної: мін. внесок мусить сходитись із мінімалкою × ставкою
    expect(p.esvMinMonthlyUah).toBeCloseTo(p.minimumWageMonthlyUah * p.esvRate, 2);
  });

  // У ВЗ три ставки поруч: 5% зарплатна, 10% мінімалки для 1/2/4 груп,
  // 1% доходу для 3-ї (п. 16-1 підрозд. 10 розд. XX ПКУ). P1 = 3 група.
  it('АНТИ-РЕГРЕС: ВЗ для 3 групи — 1% доходу, не зарплатні 5% і не 10% мінімалки', () => {
    const p = getParams<{ vzRateGroup3: number }>('fop.esv_vz');
    expect(p.vzRateGroup3).toBe(0.01);
  });

  it('наріст роботодавця при UoP ≈ 20.48%', () => {
    const er = getParams<Record<string, number>>('uop.employer_contributions');
    const total = er.emerytalne + er.rentowe + er.wypadkowe + er.fpFs + er.fgsp;
    expect(total).toBeCloseTo(0.2048, 4);
  });

  it('społeczne працівника при UoP = 13.71%', () => {
    const ee = getParams<Record<string, number>>('uop.employee_contributions');
    expect(ee.emerytalne + ee.rentowe + ee.chorobowe).toBeCloseTo(0.1371, 4);
  });

  it('ліміт nierejestrowanej 2026: 10,813.50 zł/квартал = 225% × мінімалка 4,806', () => {
    const limit = getParams<{ quarterlyLimit: number; shareOfMinimumWage: number }>(
      'nierejestrowana.limit'
    );
    const minimumWage = getParams<{ monthly: number }>('common.minimum_wage').monthly;
    expect(limit.quarterlyLimit).toBe(10813.5);
    expect(limit.shareOfMinimumWage).toBe(2.25);
    // Крос-звірка похідної: ліміт прив'язаний до мінімалки й рухається разом із
    // нею щороку. Якщо колись оновлять одне з двох — падає саме цей рядок.
    expect(limit.quarterlyLimit).toBeCloseTo(minimumWage * limit.shareOfMinimumWage, 2);
  });

  // Ліміт став КВАРТАЛЬНИМ з 01.01.2026; довідники в мережі досі дають місячний
  // (75% мінімалки). Місячне значення в даних = мовчазне вчетверо м'якше правило.
  it('АНТИ-РЕГРЕС: ліміт nierejestrowanej квартальний, не місячний', () => {
    const limit = getParams<{ quarterlyLimit: number; settledQuarterlyFrom: string }>(
      'nierejestrowana.limit'
    );
    expect(limit.settledQuarterlyFrom).toBe('2026-01-01');
    const minimumWage = getParams<{ monthly: number }>('common.minimum_wage').monthly;
    expect(limit.quarterlyLimit).not.toBeCloseTo(minimumWage * 0.75, 2);
  });

  // Найдорожча пастка сценарію H (EVIDENCE §Нестабільності п. 3): «без ZUS»
  // вірне лише для продажу товарів. Послуги = umowa o świadczenie usług = zlecenie.
  it('АНТИ-РЕГРЕС: послуги в nierejestrowanej — титул до ZUS, а не звільнення', () => {
    const zus = getParams<{ servicesAreZlecenieTitle: boolean; goodsSaleIsNoTitle: boolean }>(
      'nierejestrowana.zus'
    );
    expect(zus.servicesAreZlecenieTitle).toBe(true);
    expect(zus.goodsSaleIsNoTitle).toBe(true);
  });

  // KUP тут — фактичні задокументовані витрати (art. 20 ust. 1ba, «inne źródła»),
  // а не ричалтові 20%/50% зі zlecenia. Прапорець тримає цю межу явною.
  it('nierejestrowana не має ричалтових KUP — лише фактичні витрати', () => {
    const pit = getParams<{ lumpSumKupAvailable: boolean; actualDocumentedCostsOnly: boolean }>(
      'nierejestrowana.pit'
    );
    expect(pit.lumpSumKupAvailable).toBe(false);
    expect(pit.actualDocumentedCostsOnly).toBe(true);
  });
});

// Право працювати й вести діяльність (EVIDENCE §6 «Право працювати…», сесія 05).
// Еталони — дослівно з норм, у коментарі до кожного — стаття.
describe('право працювати: підстави й строки', () => {
  type BusinessRight = {
    equalToPolesBases: string[];
    appliesToNierejestrowanaFrom: string;
    ukrAnyLegalStayUntil: string;
    peselRequiredForCeidgFrom: string;
  };
  type WorkRight = {
    freeAccessBases: string[];
    permitBoundBases: string[];
    temporaryProtectionNotificationDays: number;
    ukrWithoutProtectionFrom: string;
    ukrWithoutProtectionTransitionYears: number;
  };
  const business = getParams<BusinessRight>('status.business_right');
  const work = getParams<WorkRight>('status.work_right');

  // Рішення Ради ЄС 2026/1912 (UdSC 06.08.2026); польський art. 106 ust. 1
  // ustawy o ochronie відсилає до нього, власної дати не має.
  it('тимчасовий захист — до 04.03.2028', () => {
    expect(getParams<{ protectionUntil: string }>('status.ukr_protection').protectionUntil).toBe('2028-03-04');
  });

  // biznes.gov.pl/001466 досі пише «do 4 marca 2027» — стара дата спецзакону.
  it('АНТИ-РЕГРЕС: у даних немає застарілого кінця захисту 04.03.2027', () => {
    expect(JSON.stringify(getParams('status.ukr_protection'))).not.toContain('2027-03-04');
  });

  // Art. 4 ust. 2 ustawy o przedsiębiorcach zagranicznych не знає карти на роботу
  // (art. 114) і візи; biznes.gov.pl/001466 прямо: «nie możesz tej działalności podjąć».
  it('АНТИ-РЕГРЕС: карта на роботу і віза не дають JDG і nierejestrowanej', () => {
    for (const base of ['temp_residence_work', 'visa']) expect(business.equalToPolesBases).not.toContain(base);
  });

  it('UKR і CUKR дають і бізнес, і працю без дозволу', () => {
    for (const base of ['temporary_protection', 'cukr']) {
      expect(business.equalToPolesBases).toContain(base);
      expect(work.freeAccessBases).toContain(base);
    }
  });

  // Асиметрія з двох законів: Niebieska Karta є в art. 4 ust. 2 pkt 1 lit. c
  // (бізнес), але в art. 3 ust. 2 pkt 1 ustawy z 20.03.2025 праця — лише в межах дозволу.
  it('Niebieska Karta: бізнес нарівні з поляками, праця — в межах дозволу', () => {
    expect(business.equalToPolesBases).toContain('blue_card');
    expect(work.permitBoundBases).toContain('blue_card');
    expect(work.freeAccessBases).not.toContain('blue_card');
  });

  it('вільний доступ і праця в межах дозволу не перетинаються', () => {
    expect(work.freeAccessBases.filter((b) => work.permitBoundBases.includes(b))).toEqual([]);
  });

  // Без цього підстава, що дає бізнес, лишилась би без відповіді про працю
  // (рев'ю 2026-10-03: шлюб із громадянином PL і продовження CEIDG). Подружжя —
  // art. 3 ust. 1 pkt 15, pobyt na kontynuację — art. 142 ust. 3 у ust. 2 pkt 1.
  it('кожна підстава, що дає бізнес, має й відповідь про працю', () => {
    const classified = [...work.freeAccessBases, ...work.permitBoundBases];
    expect(business.equalToPolesBases.filter((b) => !classified.includes(b))).toEqual([]);
  });

  // Art. 5 ust. 7 PP (з 01.06.2025) і правило nierejestrowanej говорять про ту саму дату.
  it('внутрішня звірка: обмеження nierejestrowanej — та сама дата, що в nierejestrowana.cudzoziemcy', () => {
    expect(business.appliesToNierejestrowanaFrom).toBe(
      getParams<{ restrictedFrom: string }>('nierejestrowana.cudzoziemcy').restrictedFrom
    );
  });

  // Закон 2026/203 чинний з 05.03.2026 (art. 54): старе право art. 23 спецзакону
  // діє по 04.03.2026, а 3-річний перехідний період праці (art. 41) рахується з 05.03.
  it('внутрішня звірка: кінець старого права UKR — день перед 05.03.2026', () => {
    const next = new Date(`${business.ukrAnyLegalStayUntil}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    expect(next.toISOString().slice(0, 10)).toBe(work.ukrWithoutProtectionFrom);
    expect(work.ukrWithoutProtectionFrom).toBe('2026-03-05');
    // «W okresie 3 lat od dnia wejścia w życie» — кінець навесні 2029; точний
    // останній день залежить від правил обчислення строків і в дані не йде.
    expect(work.ukrWithoutProtectionTransitionYears).toBe(3);
  });

  it('повідомлення про працю UKR — 7 днів (art. 5a); PESEL для CEIDG — з 01.11.2026 (DU/2026/507)', () => {
    expect(work.temporaryProtectionNotificationDays).toBe(7);
    expect(business.peselRequiredForCeidgFrom).toBe('2026-11-01');
  });

  it('захист втрачається після виїзду понад 30 днів (art. 109b ust. 1 pkt 2)', () => {
    expect(getParams<{ lostWhenAbroadDaysOver: number }>('status.ukr_protection').lostWhenAbroadDaysOver).toBe(30);
  });

  // Рішення 2026/1912 чинне з 05.08.2026, і умова військового обліку діє з того ж дня (UdSC).
  it('умова військового обліку для нових заявників — з 05.08.2026', () => {
    expect(getParams<{ militaryObligationForNewFrom: string }>('status.ukr_protection').militaryObligationForNewFrom).toBe(
      '2026-08-05'
    );
  });

  // Розтяжка, як «не старше 180 днів» вище: свідомо червоніє від плину часу.
  // Автозвірка читає новину UdSC про 2028, і нове рішення Ради ЄС вона не побачить
  // (pages.mjs, коментар до status.ukr_protection). Рішення 2026/1912 ухвалили за
  // 7 місяців до кінця захисту, тож за 180 днів наступне вже має бути відоме.
  it('до кінця тимчасового захисту більше 180 днів — інакше перезвірити рішення ЄС', () => {
    const until = getParams<{ protectionUntil: string }>('status.ukr_protection').protectionUntil;
    expect(-daysSince(until), 'знайти нове рішення Ради ЄС і /scaffold-rule status.ukr_protection').toBeGreaterThan(180);
  });

  // Реформа PIP одна: zlecenie і B2B стоять на одній даті й одній сторінці.
  it('внутрішня звірка: PIP для B2B — та сама дата 08.07.2026, що для zlecenia', () => {
    const b2b = getParams<{ pipDecisionPowerFrom: string; coversB2b: boolean }>('jdg.przekwalifikowanie');
    expect(b2b.coversB2b).toBe(true);
    expect(b2b.pipDecisionPowerFrom).toBe('2026-07-08');
    expect(b2b.pipDecisionPowerFrom).toBe(
      getParams<{ pipDecisionPowerFrom: string }>('zlecenie.przekwalifikowanie').pipDecisionPowerFrom
    );
  });
});
