import { describe, expect, it } from 'vitest';
import { ruleNumber } from '../calc/facts';
import { ANSWER_PAGES, answerPage, type AnswerPageContent } from '../content';
import { contentStrings, numberLiterals, resolveAnswerPage } from '../answer-page';
import { formatAmount, formatPercent } from '../format';
import { LOCALES } from '../i18n';
import { RULES } from '../rules/types';
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
    expect(() => ruleNumber('jdg.ryczalt.rate', 'rateNope')).toThrow(/No number/);
    // `null` у верхньому порозі — «без межі», а не нуль.
    expect(() => ruleNumber('jdg.zdrowotna.ryczalt', 'tiers.2.annualRevenueUpTo')).toThrow(/Not a number/);
    expect(() => ruleNumber('residency.days_threshold', 'partialDayCountsAsFull')).toThrow(/Not a number/);
    expect(() => ruleNumber('jdg.nope', 'x')).toThrow(/Unknown rule_id/);
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

  it('кнопка в анкету несе передзаповнення сторінки і лише його', () => {
    for (const { locale, content } of allPages) {
      const href = resolveAnswerPage(locale, content).questionnaireHref;
      const [path, query] = href.split('?');
      expect(path).toBe(`/${locale}/poland/questionnaire`);
      expect(isPrefill(query)).toBe(true);
      expect(decodeAnswers(query)).toEqual(content.prefill);
    }
  });
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
