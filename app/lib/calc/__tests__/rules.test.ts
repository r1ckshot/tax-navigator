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
