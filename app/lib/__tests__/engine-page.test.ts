import { describe, expect, it } from 'vitest';
import { compareScenarios } from '../calc/scenarios';
import { quantizeRevenue } from '../calc/quantize';
import { ANSWER_PAGES, ENGINE_AMOUNTS, ENGINE_TEXTS } from '../content';
import { engineAmountOf, engineAnswers, engineSlug, engineSlugs, resolveEnginePage } from '../engine-page';
import { numberLiterals } from '../answer-page';
import { formatMoney, formatRange } from '../format';
import { LOCALES } from '../i18n';
import { RULES } from '../rules/types';
import { COUNTRY_PAGES } from '../routes';
import { decodeAnswers, isPrefill } from '../share';
import { plain } from './plain';

/** Увесь текст сторінки одним рядком: заголовок, опис, лід, блоки, таблиця, посилання. */
function allText(page: ReturnType<typeof resolveEnginePage>): string {
  const blocks = page.body.flatMap((b) => [
    b.text ?? '',
    ...(b.items ?? []),
    ...(b.links?.map((l) => l.text) ?? []),
    ...(b.table ? [b.table.caption, ...b.table.head, ...b.table.rows.flat()] : []),
  ]);
  return [page.title, page.description, page.lead, ...blocks].join('\n');
}

const pages = LOCALES.flatMap((locale) => ENGINE_AMOUNTS[locale].map((amount) => ({ locale, amount })));

function rows(locale: 'uk', amount: number): string[][] {
  const table = resolveEnginePage(locale, amount).body.find((b) => b.kind === 'table')!.table!;
  return table.rows.map(([form, range]) => [plain(form), plain(range)]);
}

describe('набір сум', () => {
  // Сума, якої немає на шкалі анкети, квантизувалась би в інше число, і сторінка
  // розійшлась би з анкетою на «тій самій» виручці.
  it.each(pages.map(({ amount }) => [amount]))('%i лежить на шкалі анкети', (amount) => {
    expect(quantizeRevenue(amount)).toBe(amount);
  });

  it('slug — латиниця, унікальний, не збігається зі сторінкою-відповіддю чи країни', () => {
    for (const locale of LOCALES) {
      const slugs = engineSlugs(locale);
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs[0]).toBe('b2b-10000-zl');
      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(COUNTRY_PAGES as readonly string[]).not.toContain(slug);
        expect(ANSWER_PAGES[locale].map((p) => p.slug)).not.toContain(slug);
      }
    }
  });

  it('невідома сума — не сторінка', () => {
    expect(engineAmountOf('uk', engineSlug(15000))).toBe(15000);
    expect(engineAmountOf('uk', 'b2b-15001-zl')).toBeUndefined();
    expect(engineAmountOf('uk', 'b2b-na-ruky')).toBeUndefined();
  });
});

describe('сторінка = той самий розрахунок, що в анкеті', () => {
  it.each(pages.map(({ amount }) => [amount]))('%i: рядки таблиці збігаються з compareScenarios', (amount) => {
    const [fop, jdg, , , , uop] = compareScenarios(engineAnswers(amount));
    expect(fop.id).toBe('fop');
    const bySubform = (id: string) => jdg.subforms!.find((s) => s.id === id)!;
    expect(rows('uk', amount).map(([, range]) => range)).toEqual(
      [bySubform('ryczalt'), bySubform('liniowy'), bySubform('skala')]
        .map((s) => plain(formatRange(s.rangeMonthly!)))
        .concat(plain(formatRange(uop.rangeMonthly!))),
    );
  });

  it('усі чотири рядки мають число: за цих припущень жодна форма не недоступна', () => {
    for (const { amount } of pages) {
      for (const [, range] of rows('uk', amount)) expect(range).toMatch(/^\d[\d ]* – \d[\d ]*$/);
    }
  });

  /**
   * Еталони виведено вручну з правил 2026: внески ZUS повні 1 926,76 (jdg.zus.stages),
   * витрати 5% (середина «менше 10%»), смуга ±4% (UNCERTAINTY.ARITHMETIC).
   *
   * Ричалт 15 000: зdrowotna 830,58 (річна виручка 180 000 → до 300 000);
   * база = 15 000 − 0,5·830,58 = 14 584,71; податок 12% = 1 750,17;
   * на руки = 15 000 − 750 − 1 750,17 − 830,58 − 1 926,76 = 9 742,49;
   * смуга 9 742,49 ± 389,70 → 9 353 – 10 132.
   *
   * Лінійний 10 000: дохід = 10 000 − 500 − 1 926,76 = 7 573,24; zdrowotna =
   * max(4,9%·дохід = 371,09; мінімум 432,54) = 432,54; податок 19%·(7 573,24 −
   * 432,54) = 1 356,73; на руки = 5 783,97; смуга ± 231,36 → 5 553 – 6 015.
   *
   * Шкала 15 000: дохід = 15 000 − 750 − 1 926,76 = 12 323,24; zdrowotna 9% =
   * 1 109,09; рік 147 878,88: 12%·120 000 + 32%·27 878,88 − 3 600 = 19 721,24
   * → 1 643,44 на місяць; на руки = 9 570,71; смуга ± 382,83 → 9 188 – 9 954.
   */
  it('еталони, виведені вручну', () => {
    expect(rows('uk', 15000)[0]).toEqual(['JDG, ричалт', '9 353 – 10 132']);
    expect(rows('uk', 10000)[1]).toEqual(['JDG, лінійний податок', '5 553 – 6 015']);
    expect(rows('uk', 15000)[2]).toEqual(['JDG, шкала', '9 188 – 9 954']);
  });

  it('сума в заголовку і припущеннях — крок шкали, відформатований як у результаті', () => {
    const page = resolveEnginePage('uk', 25000);
    expect(plain(page.title)).toBe(`B2B у Польщі: ${plain(formatMoney(25000))} zł на місяць — скільки лишається`);
    expect(plain(page.title)).toContain('25 000');
    expect(page.body.find((b) => b.kind === 'list')!.items!.map(plain)).toContain('виручка за рахунками — 25 000 zł на місяць без VAT;');
  });

  // Текст припущень — літерали; профіль — код. Розійдуться — сторінка називатиме
  // одне, а рахуватиме інше.
  it('профіль у коді — той, що названий в припущеннях', () => {
    const a = engineAnswers(20000);
    expect(a).toMatchObject({
      workKind: 'programming', // «діяльність — програмування»
      expenseShare: 'lt10', // «менше десятої частини виручки»
      jdgStatus: 'gt30', // «понад два з половиною роки» = понад 30 місяців
      voluntarySickness: true, // «з хворобовим страхуванням»
      hasParallelUop: false, // «не працюєте паралельно за трудовим договором»
      formerEmployer: 'no', // «не виконуєте ті самі послуги колишньому роботодавцю»
      hadJdgInLast60Months: false,
      personalCenter: 'PL',
      economicCenter: 'PL',
      daysInPl: 'gte183',
    });
  });

  it('припущення називають профіль: резидент, програмування, повний ZUS, без пільг', () => {
    const items = resolveEnginePage('uk', 20000).body.find((b) => b.kind === 'list')!.items!.map(plain);
    expect(items).toEqual([
      'виручка за рахунками — 20 000 zł на місяць без VAT;',
      'ви податковий резидент Польщі, а підстава перебування дозволяє вести JDG;',
      'діяльність — програмування, витрати малі: менше десятої частини виручки, розрахунок бере середину цього діапазону;',
      // jdg.zus.stages.duzyMonthly — з правила, а не з тексту.
      'JDG працює вже понад два з половиною роки, тому внески ZUS повні — 1 926,76 zł на місяць з хворобовим страхуванням;',
      'ви не працюєте паралельно за трудовим договором і не виконуєте ті самі послуги колишньому роботодавцю;',
      'IP Box та інші пільги не враховано.',
    ]);
  });
});

describe('анкета з сторінки з движка', () => {
  it.each(pages.map(({ amount }) => [amount]))('%i: посилання несе профіль сторінки і суму', (amount) => {
    const page = resolveEnginePage('uk', amount);
    const [path, query] = page.questionnaireHref.split('?');
    expect(path).toBe('/uk/poland/questionnaire');
    expect(isPrefill(query)).toBe(true);
    const decoded = decodeAnswers(query);
    expect(decoded.monthlyRevenue).toBe(amount);
    // Те, що відкриється в анкеті, — рівно те, з чого пораховано таблицю.
    const answers = engineAnswers(amount) as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(decoded)) expect(answers[key], key).toEqual(value);
    // Резидентство й підставу перебування сторінка не вгадує за людину.
    expect(decoded.stayBasis).toBeUndefined();
    expect(decoded.daysInPl).toBeUndefined();
  });
});

describe('джерела й текст', () => {
  it('кожне джерело — з правил, назвою; rule_id на сторінці немає', () => {
    for (const { amount } of pages) {
      const page = resolveEnginePage('uk', amount);
      expect(page.sources.length).toBeGreaterThan(0);
      for (const s of page.sources) expect(RULES.rules.some((r) => r.source_url === s.url && r.source_title === s.title)).toBe(true);
      const text = allText(page);
      for (const rule of RULES.rules) expect(text).not.toContain(rule.rule_id);
    }
  });

  it('джерела охоплюють ZUS, три форми JDG і трудовий договір', () => {
    // Правила з одним джерелом зливаються в один рядок (url + назва), тож
    // перевіряємо джерело правила, а не його id.
    const urls = new Set(resolveEnginePage('uk', 15000).sources.map((s) => s.url));
    for (const id of ['jdg.zus.stages', 'jdg.ryczalt.rate', 'jdg.liniowy', 'jdg.skala', 'uop.employer_contributions']) {
      const rule = RULES.rules.find((r) => r.rule_id === id)!;
      expect(urls.has(rule.source_url), id).toBe(true);
    }
    // Підставу перебування називає припущення — і лише воно цитує право на JDG;
    // захист UKR із розрахунку трудового договору під жодним твердженням не стоїть.
    const ruleIds = resolveEnginePage('uk', 15000).sources.map((s) => s.ruleId);
    expect(ruleIds).toContain('status.business_right');
    expect(ruleIds).not.toContain('status.ukr_protection');
  });

  // Той самий guard, що й для сторінок-відповідей: число — або `{amount}`, або правило.
  it('у тексті немає власних цифр поза {amount} і плейсхолдерами правил', () => {
    for (const locale of LOCALES) {
      const t = ENGINE_TEXTS[locale];
      const strings = [
        t.title, t.description, t.lead, t.assumptionsTitle, ...t.assumptions, t.resultTitle, t.tableCaption,
        ...t.tableHead, ...Object.values(t.rowLabels), t.unavailable, t.resultNote, t.limitsTitle, t.limits,
        t.seeAlsoTitle, t.otherAmountsLabel, ...t.related.map((r) => r.text),
      ];
      for (const s of strings) expect(numberLiterals(s.replaceAll('{amount}', '')), s).toEqual([]);
    }
  });

  it('без слів-порад', () => {
    for (const { amount } of pages) {
      const page = resolveEnginePage('uk', amount);
      const text = allText(page);
      expect(text).not.toMatch(/краще|вигідн|рекоменд|радимо|раджу|оберіть|обирайте|слід обрати/i);
    }
  });

  it('жодного плейсхолдера чи {amount} не лишилось', () => {
    for (const { amount } of pages) {
      const page = resolveEnginePage('uk', amount);
      expect(allText(page)).not.toMatch(/\{\{|\}\}|\{amount\}/);
    }
  });
});

describe('перелінковка', () => {
  const known = (locale: 'uk') => [
    ...ANSWER_PAGES[locale].map((p) => p.slug),
    ...engineSlugs(locale),
    ...COUNTRY_PAGES,
  ];

  it('кожне посилання зі сторінок-відповідей веде на наявну сторінку, не на себе', () => {
    for (const locale of LOCALES) {
      for (const page of ANSWER_PAGES[locale]) {
        const targets = page.body.flatMap((b) => (b.kind === 'links' ? b.items.map((i) => i.to) : []));
        expect(targets.length, page.slug).toBeGreaterThan(0);
        for (const to of targets) {
          expect(known(locale), `${page.slug} → ${to}`).toContain(to);
          expect(to).not.toBe(page.slug);
        }
      }
    }
  });

  it('сторінка з движка веде на пов’язані сторінки і на інші суми, не на себе', () => {
    const page = resolveEnginePage('uk', 20000);
    const hrefs = page.body.find((b) => b.kind === 'links')!.links!.map((l) => l.href);
    expect(hrefs).toContain('/uk/poland/b2b-na-ruky');
    expect(hrefs).toContain('/uk/poland/b2b-10000-zl');
    expect(hrefs).not.toContain('/uk/poland/b2b-20000-zl');
    for (const href of hrefs) expect(known('uk')).toContain(href.replace('/uk/poland/', ''));
  });

  it('кожна сторінка-відповідь і сторінка з движка досяжна з іншої сторінки', () => {
    const linkedTo = new Set<string>();
    for (const page of ANSWER_PAGES.uk) {
      for (const b of page.body) if (b.kind === 'links') b.items.forEach((i) => linkedTo.add(i.to));
    }
    for (const { amount } of pages) {
      for (const b of resolveEnginePage('uk', amount).body) b.links?.forEach((l) => linkedTo.add(l.href.replace('/uk/poland/', '')));
    }
    for (const page of ANSWER_PAGES.uk) expect(linkedTo.has(page.slug), page.slug).toBe(true);
    for (const slug of engineSlugs('uk')) expect(linkedTo.has(slug), slug).toBe(true);
  });
});
