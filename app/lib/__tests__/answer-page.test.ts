import { describe, expect, it } from 'vitest';
import { ruleDate, ruleNumber } from '../calc/facts';
import { ANSWER_PAGES, answerPage, type AnswerPageContent } from '../content';
import { contentStrings, numberLiterals, resolveAnswerPage } from '../answer-page';
import { formatAmount, formatPercent } from '../format';
import { LOCALES } from '../i18n';
import { RULES, getParams } from '../rules/types';
import { COUNTRY_PAGES } from '../routes';
import { decodeAnswers, isPrefill } from '../share';
import { plain } from './plain';

const allPages = LOCALES.flatMap((locale) => ANSWER_PAGES[locale].map((content) => ({ locale, content })));

describe('ruleNumber: число з правила разом із джерелом', () => {
  it('ключ params і індекс масиву', () => {
    expect(ruleNumber('jdg.ryczalt.rate', 'rateProgramming').value).toBe(0.12);
    expect(ruleNumber('jdg.zdrowotna.ryczalt', 'tiers.1.monthly').value).toBe(830.58);
    const { source } = ruleNumber('jdg.ryczalt.rate', 'annualLimit');
    expect(source).toEqual({
      ruleId: 'jdg.ryczalt.rate',
      title: 'Stawki i limity',
      url: 'https://www.podatki.gov.pl/podatki-firmowe/pit/stawki-i-limity',
      verifiedAt: RULES.rules.find((r) => r.rule_id === 'jdg.ryczalt.rate')!.verified_at,
    });
  });

  it('немає шляху, не число, невідоме правило — виняток, а не undefined на сторінці', () => {
    expect(() => ruleNumber('jdg.ryczalt.rate', 'rateNope')).toThrow(/No value/);
    // `null` у верхньому порозі — «без межі», а не нуль.
    expect(() => ruleNumber('jdg.zdrowotna.ryczalt', 'tiers.2.annualRevenueUpTo')).toThrow(/Not a number/);
    expect(() => ruleNumber('residency.days_threshold', 'partialDayCountsAsFull')).toThrow(/Not a number/);
    expect(() => ruleNumber('jdg.nope', 'x')).toThrow(/Unknown rule_id/);
  });
});

describe('ruleDate: дата з правила разом із джерелом', () => {
  it('ISO-дата і джерело правила', () => {
    const { value, source } = ruleDate('status.ukr_protection', 'protectionUntil');
    expect(value).toBe('2028-03-04');
    expect(source.ruleId).toBe('status.ukr_protection');
  });

  it('не дата чи немає шляху — виняток', () => {
    expect(() => ruleDate('status.ukr_protection', 'lostWhenAbroadDaysOver')).toThrow(/Not a date/);
    expect(() => ruleDate('status.ukr_protection', 'nope')).toThrow(/No value/);
    // Рядок, але не дата: код підстави — не дата для тексту.
    expect(() => ruleDate('status.business_right', 'equalToPolesBases.0')).toThrow(/Not a date/);
  });
});

describe('формати чисел на сторінці', () => {
  // Еталони виписано вручну: групування uk-UA — нерозривний пробіл, кома — десяткова.
  it('сума — як у джерелі, до копійки', () => {
    expect(plain(formatAmount(8517200))).toBe('8 517 200');
    expect(plain(formatAmount(498.35))).toBe('498,35');
    expect(plain(formatAmount(1495.04))).toBe('1 495,04');
    expect(plain(formatAmount(1441.8))).toBe('1 441,80');
  });

  it('частка — відсоток без хвоста плаваючої коми', () => {
    expect(formatPercent(0.12)).toBe('12%');
    expect(formatPercent(0.085)).toBe('8,5%');
    expect(formatPercent(0.5)).toBe('50%');
  });
});

describe('guard: у тексті сторінки немає власних цифр', () => {
  it('літерал знаходиться; плейсхолдер і посилання на норму — ні', () => {
    expect(numberLiterals('ставка 12% від виручки')).toEqual(['12']);
    expect(numberLiterals('до 8 517 200 zł')).toEqual(['8 517 200']);
    expect(numberLiterals('ставка {{percent:jdg.ryczalt.rate/rateProgramming}}')).toEqual([]);
    expect(numberLiterals('art. 8 ust. 2 ustawy, ст. 8 ч. 5 Закону')).toEqual([]);
    expect(numberLiterals('у 2026 році')).toEqual(['2026']);
    expect(numberLiterals('за шкалою. {{cite:jdg.byly_pracodawca}}')).toEqual([]);
    expect(numberLiterals('з {{date:status.ukr_protection/protectionUntil}}')).toEqual([]);
  });

  it('«art. 22 § 1» і «B2B» — не числа; список назв з цифрою закритий', () => {
    expect(numberLiterals('Кодекс праці (art. 22 § 1), B2B через JDG')).toEqual([]);
    expect(numberLiterals('PIT-37 і B2C2')).toEqual(['37', '2', '2']);
    expect(numberLiterals('B2B2')).toEqual(['2', '2']);
  });

  // Головний guard: кожне число на кожній сторінці — з правила. Перевірено
  // поломкою (сесія 13): літерал «12%» у lead демо-сторінки валить цей тест.
  it.each(allPages.map(({ locale, content }) => [`${locale}/${content.slug}`, content] as const))(
    '%s: кожне число — плейсхолдер правила',
    (_name, content: AnswerPageContent) => {
      for (const text of contentStrings(content)) expect(numberLiterals(text), text).toEqual([]);
    },
  );
});

describe('збірка сторінки', () => {
  it.each(allPages.map(({ locale, content }) => [`${locale}/${content.slug}`, locale, content] as const))(
    '%s: збирається, без сирих плейсхолдерів, з джерелами',
    (_name, locale, content) => {
      const page = resolveAnswerPage(locale, content);
      const text = [page.title, page.description, page.lead, ...page.body.flatMap((b) => b.items ?? [b.text!])].join('\n');
      expect(text).not.toMatch(/\{\{|\}\}/);
      expect(page.sources.length).toBeGreaterThan(0);
      for (const s of page.sources) expect(RULES.rules.some((r) => r.source_url === s.url && r.source_title === s.title)).toBe(true);
    },
  );

  it('невідомий формат і зламаний плейсхолдер падають на збірці', () => {
    const broken = (lead: string): AnswerPageContent => ({ ...answerPage('uk', 'ryczalt-it')!, lead });
    expect(() => resolveAnswerPage('uk', broken('{{money:jdg.ryczalt.rate/annualLimit}}'))).toThrow(/Unknown number format/);
    expect(() => resolveAnswerPage('uk', broken('{{amount:jdg.ryczalt.rate}}'))).toThrow(/Malformed/);
  });

  it('slug — латиниця, унікальний у мові, не збігається зі сторінкою країни', () => {
    for (const locale of LOCALES) {
      const slugs = ANSWER_PAGES[locale].map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(COUNTRY_PAGES as readonly string[]).not.toContain(slug);
      }
    }
  });

  it('кнопка в анкету несе передзаповнення сторінки і лише його; без нього — звичайна анкета', () => {
    for (const { locale, content } of allPages) {
      const page = resolveAnswerPage(locale, content);
      const [path, query] = page.questionnaireHref.split('?');
      expect(path).toBe(`/${locale}/poland/questionnaire`);
      if (Object.keys(content.prefill).length === 0) {
        expect(page.prefilled, content.slug).toBe(false);
        expect(query, content.slug).toBeUndefined();
        continue;
      }
      expect(page.prefilled).toBe(true);
      expect(isPrefill(query)).toBe(true);
      expect(decodeAnswers(query)).toEqual(content.prefill);
    }
  });

  // P0-2 (product-safety): сторінка порівнює й пояснює, а не обирає за людину.
  it.each(allPages.map(({ locale, content }) => [`${locale}/${content.slug}`, content] as const))(
    '%s: без слів-порад',
    (_name, content: AnswerPageContent) => {
      for (const text of contentStrings(content)) {
        expect(text, text).not.toMatch(/краще|вигідн|рекоменд|радимо|раджу|оберіть|обирайте|слід обрати/i);
      }
    },
  );
});

/**
 * Демо-сторінка: кожна показана цифра з еталоном, виведеним із матриці вручну
 * (jdg.ryczalt.rate, jdg.zdrowotna.ryczalt — EVIDENCE, сценарій B).
 */
describe('демо: ryczalt-it', () => {
  const page = resolveAnswerPage('uk', answerPage('uk', 'ryczalt-it')!);
  const list = page.body.find((b) => b.kind === 'list')!.items!.map(plain);

  it('ставка 0.12 → «12%» у lead', () => {
    expect(plain(page.lead)).toContain('ставка 12%.');
  });

  it('ставка в заголовку теж з правила, без «· nettomap»', () => {
    expect(plain(page.title)).toBe('Ричалт 12% для програміста на JDG');
  });

  it('ліміт 8517200 → «8 517 200 zł»', () => {
    expect(page.body.map((b) => plain(b.text ?? '')).join(' ')).toContain('не більша за 8 517 200 zł');
  });

  it('пороги складки 60000/300000 і місячні 498.35/830.58/1495.04', () => {
    expect(list).toEqual([
      'до 60 000 zł включно — 498,35 zł на місяць;',
      'понад 60 000 і до 300 000 zł — 830,58 zł на місяць;',
      'понад 300 000 zł — 1 495,04 zł на місяць.',
    ]);
  });

  // Рев'ю сесії 13: у EVIDENCE ці два факти лише прозою, без «Верифіковано».
  it('без незвірених тверджень про 50% внеску і доплату за рік', () => {
    const text = page.body.map((b) => plain(b.text ?? '')).join(' ');
    expect(text).not.toMatch(/50%|доплачують/);
  });

  it('джерела — у порядку появи, назвою, а не rule_id; твердження без числа теж цитоване', () => {
    expect(page.sources.map((s) => s.title)).toEqual([
      'Stawki i limity',
      'Ustawa o zryczałtowanym podatku dochodowym od niektórych przychodów osiąganych przez osoby fizyczne',
      'Główny Urząd Statystyczny',
      'Nowe wysokości składek na ubezpieczenia społeczne w 2026 r.',
    ]);
  });

  it('маркер cite нічого не друкує й не лишає пробілу перед собою', () => {
    const p = page.body.map((b) => plain(b.text ?? '')).find((x) => x.includes('за шкалою'))!;
    expect(p.endsWith('рахується за шкалою.')).toBe(true);
  });

  it('невідоме правило в cite падає на збірці', () => {
    const content = { ...answerPage('uk', 'ryczalt-it')!, lead: 'x {{cite:jdg.nope}}' };
    expect(() => resolveAnswerPage('uk', content)).toThrow(/Unknown rule_id/);
  });

  it('анкета відкривається з «програмуванням», без суми', () => {
    expect(page.questionnaireHref).toBe('/uk/poland/questionnaire?w=programming&start=1');
  });
});

/**
 * Сторінки сесії 14. Кожна показана цифра — з еталоном, виведеним із правила
 * вручну: дата ISO → ДД.ММ.РРРР, частка → відсоток, сума → як у джерелі з
 * нерозривним пробілом тисяч (у `plain` — звичайним). Звідки число — у дужках.
 */
const text = (slug: string) => {
  const page = resolveAnswerPage('uk', answerPage('uk', slug)!);
  return plain([page.title, page.lead, ...page.body.flatMap((b) => b.items ?? [b.text!])].join('\n'));
};
const sourceTitles = (slug: string) => resolveAnswerPage('uk', answerPage('uk', slug)!).sources.map((s) => s.title);

describe('сторінка jdg-ukr-cukr', () => {
  const t = text('jdg-ukr-cukr');

  it('дати з правил статусу', () => {
    expect(t).toContain('До 04.03.2026 включно JDG міг відкрити'); // business_right.ukrAnyLegalStayUntil 2026-03-04
    expect(t).toContain('з 01.06.2025 іноземцю потрібна підстава з того самого переліку'); // appliesToNierejestrowanaFrom
    expect(t).toContain('продовжено до 04.03.2028'); // ukr_protection.protectionUntil
    expect(t).toContain('З 05.08.2026 новий захист'); // militaryObligationForNewFrom
    expect(t).toContain('З 01.11.2026 іноземець'); // business_right.peselRequiredForCeidgFrom
    expect(t).toContain('3 роки від 05.03.2026'); // work_right: transition 3 роки від ukrWithoutProtectionFrom
  });

  // Рев'ю сесії 14: CUKR — не підстава з art. 4 ust. 2, а окреме право art. 42w спецзакону.
  it('CUKR не стоїть у переліку закону про іноземних підприємців', () => {
    expect(t).toContain('Окремо таке саме право дає карта CUKR (art. 42w спецзакону)');
    const list = t.split('\n').find((line) => line.startsWith('Громадяни ЄС'))!;
    expect(list.split('Окремо')[0]).not.toContain('CUKR');
  });

  it('строки в днях', () => {
    expect(t).toContain('більш ніж на 30 днів'); // ukr_protection.lostWhenAbroadDaysOver
    expect(t).toContain('протягом 7 днів від початку роботи'); // work_right.temporaryProtectionNotificationDays
  });

  it('джерела: бізнес, захист, праця', () => {
    expect(sourceTitles('jdg-ukr-cukr')).toEqual([
      'Działalność gospodarcza cudzoziemców w Polsce',
      'Przedłużenie ochrony czasowej do 4 marca 2028 r.',
      'Ustawa z 20 marca 2025 r. o warunkach dopuszczalności powierzania pracy cudzoziemcom',
    ]);
  });
});

describe('сторінка rezydentstvo-bank-broker', () => {
  const t = text('rezydentstvo-bank-broker');

  it('понад 183 дні — за законом рівно 183 ще не резидент', () => {
    expect(t).toContain('понад 183 дні за податковий рік'); // days_threshold.days, art. 3 ust. 1a pkt 2
    expect(t).not.toMatch(/183 дні або більше|щонайменше 183/);
  });

  it('період спецнорми і строк нової заяви', () => {
    expect(t).toContain('з 01.01.2024 до 31.12.2026'); // special_norm_52zr.validFrom / validTo
    expect(t).toContain('протягом 30 днів'); // crs_self_certification.updateWithinDaysAfterChange
  });

  it('джерела: Objaśnienia, art. 52zr, договір PL-UA, закон про обмін інформацією', () => {
    expect(sourceTitles('rezydentstvo-bank-broker')).toEqual([
      'Objaśnienia podatkowe z 29 kwietnia 2021 r. ws. rezydencji podatkowej',
      'Ustawa z 23 stycznia 2026 r. (art. 52zr ustawy o PIT)',
      'Umowa między Polską a Ukrainą w sprawie unikania podwójnego opodatkowania (1993)',
      'Ustawa o wymianie informacji podatkowych z innymi państwami',
    ]);
  });
});

describe('сторінка vat-jdg', () => {
  const t = text('vat-jdg');

  it('ліміт 240000 → «240 000 zł», старого 200 000 немає', () => {
    // jdg.vat.exemptionAnnualLimit; обидва роки — art. 113 ust. 1 («w poprzednim ani bieżącym roku»).
    expect(t).toContain('не перевищив 240 000 zł ні в попередньому, ні в поточному році');
    expect(t).not.toContain('200 000');
  });

  it('«через рік» словами стоїть на правилі, де повернення — 1 рік', () => {
    expect(getParams<{ returnNotEarlierThanYearsAfterYearEnd: number }>('jdg.vat').returnNotEarlierThanYearsAfterYearEnd).toBe(1);
    expect(t).toContain('не раніше ніж через рік після кінця року');
  });

  it('джерело — закон про VAT', () => {
    expect(sourceTitles('vat-jdg')).toEqual(['Ustawa o podatku od towarów i usług']);
  });
});

describe('сторінка pip-b2b', () => {
  it('дата реформи в заголовку і тексті (jdg.przekwalifikowanie.pipDecisionPowerFrom 2026-07-08)', () => {
    const t = text('pip-b2b');
    expect(t.split('\n')[0]).toBe('Перевірки PIP і B2B з 08.07.2026');
    expect(t).toContain('чинних на 08.07.2026');
    expect(sourceTitles('pip-b2b')).toEqual(['Reforma Państwowej Inspekcji Pracy']);
  });
});

describe('сторінка pilgovyi-zus', () => {
  const t = text('pilgovyi-zus');

  it('строки етапів: 6 і 24 місяці, умова 60 місяців (jdg.zus.stages)', () => {
    expect(t).toContain('перші 6 місяців не платить соціальних внесків');
    expect(t).toContain('наступні 24 місяці платить знижені');
    expect(t).toContain('останні 60 місяців');
  });

  it('суми: база 1441.8 і 456.18 / 420.86; база 5652 і 1926.76', () => {
    // Закон: «zadeklarowana kwota, nieniższa jednak niż» — база мінімальна, не єдина.
    expect(t).toContain('зниженої бази — щонайменше 1 441,80 zł');
    expect(t).toContain('456,18 zł на місяць з добровільним хворобовим страхуванням');
    expect(t).toContain('або 420,86 zł без нього');
    expect(t).toContain('від бази щонайменше 5 652 zł');
    expect(t).toContain('це 1 926,76 zł на місяць');
  });
});

describe('сторінка fop-chy-jdg', () => {
  const t = text('fop-chy-jdg');

  it('українська сторона: ЄП 0.05, ВЗ 0.01, ЄСВ 0.22 і мінімум 1902.34 грн', () => {
    expect(t).toContain('єдиний податок 5% доходу для третьої групи без ПДВ');
    expect(t).toContain('військовий збір 1% доходу');
    expect(t).toContain('ЄСВ 22% від бази — щонайменше 1 902,34 грн на місяць');
  });

  it('форми JDG: лінійний 0.19, шкала 0.12 і 0.32', () => {
    expect(t).toContain('лінійний 19% від доходу або шкала 12% і 32%');
  });

  // Рев'ю сесії 14: «ФОП чи JDG» не каже напевно, що ФОП уже є, — без передзаповнення.
  it('анкета відкривається без передзаповнення', () => {
    expect(resolveAnswerPage('uk', answerPage('uk', 'fop-chy-jdg')!).questionnaireHref).toBe('/uk/poland/questionnaire');
  });

  it('джерело вступу (art. 3 ust. 1 — Objaśnienia) стоїть першим', () => {
    expect(sourceTitles('fop-chy-jdg')[0]).toBe('Objaśnienia podatkowe z 29 kwietnia 2021 r. ws. rezydencji podatkowej');
  });
});

describe('сторінка b2b-na-ruky', () => {
  const t = text('b2b-na-ruky');

  it('ставки трьох форм і поріг шкали (jdg.ryczalt.rate, jdg.liniowy, jdg.skala)', () => {
    expect(t).toContain('12% від виручки за програмування');
    expect(t).toContain('19% від доходу');
    expect(t).toContain('12% до 120 000 zł доходу за рік і 32% з надлишку; неоподатковувана сума — 30 000 zł');
  });

  it('внески: повний ZUS 1926.76, здоровʼя 0.049 / 0.09 з мінімумом 432.54', () => {
    expect(t).toContain('повні — щонайменше 1 926,76 zł на місяць');
    // Рев'ю сесії 14: умови пільг не випадають (jdg.zus.stages.priorBusinessLookbackMonths).
    expect(t).toContain('вела діяльність останні 60 місяців');
    expect(t).toContain('4,9% доходу, але не менше 432,54 zł');
    expect(t).toContain('9% доходу, але не менше 432,54 zł');
  });

  it('суми «на руки» сторінка не називає — лише складові', () => {
    expect(t).not.toMatch(/на руки\s*(—|:)?\s*\d/);
  });
});
