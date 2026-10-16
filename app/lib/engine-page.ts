import { assessZus } from '@/lib/calc/zus';
import { quantizeRevenue } from '@/lib/calc/quantize';
import { calcJdg, calcUop } from '@/lib/calc/scenarios';
import type { Answers, Range, SubformId } from '@/lib/calc/types';
import { ENGINE_AMOUNTS, ENGINE_TEXTS } from '@/lib/content';
import { formatMoney, formatRange } from '@/lib/format';
import { LOCALES, type Locale } from '@/lib/i18n';
import { typeset } from '@/lib/i18n/typeset';
import type { Source } from '@/lib/rules/types';
import { answerAlternates, answerHref, countryHref } from '@/lib/routes';
import { encodePrefill } from '@/lib/share';
import { cite, resolveText, type ResolvedAnswerPage, type ResolvedBlock } from './answer-page';

/**
 * Сторінки «B2B N zł»: те саме порівняння, що в анкеті, на одному умовному
 * профілі. Число сторінки — результат `calc/` (`calcJdg`, `calcUop`), а не
 * копія формули, тож воно збігається з анкетою на тих самих відповідях.
 * Профіль названо на сторінці вголос: без припущень діапазон вводив би в оману.
 */

/** Відповіді, з яких рахується сторінка суми `amount`. Єдине джерело профілю. */
export function engineAnswers(amount: number): Answers {
  return {
    stayBasis: 'ukr',
    daysInPl: 'gte183',
    personalCenter: 'PL',
    economicCenter: 'PL',
    specialLaw52zr: 'no',
    incomeSource: 'plClients',
    permanentHomeInUa: false,
    hasActiveUaFop: false,
    monthlyRevenue: quantizeRevenue(amount),
    workKind: 'programming',
    expenseShare: 'lt10',
    hasParallelUop: false,
    formerEmployer: 'no',
    jdgStatus: 'gt30',
    hadJdgInLast60Months: false,
    voluntarySickness: true,
    clientCount: 'several',
  };
}

/**
 * Відповіді, які сторінка називає в припущеннях, — їх анкета відкриється вже
 * вибраними, разом із сумою (крок шкали, не сирий дохід). Решту — резидентство,
 * підставу перебування — людина вкаже сама.
 */
function prefillOf(answers: Answers): Partial<Answers> {
  const { workKind, expenseShare, hasParallelUop, formerEmployer, jdgStatus, voluntarySickness, monthlyRevenue } = answers;
  return { workKind, expenseShare, hasParallelUop, formerEmployer, jdgStatus, voluntarySickness, monthlyRevenue };
}

export function engineSlug(amount: number): string {
  return `b2b-${amount}-zl`;
}

export function engineAmounts(locale: Locale): readonly number[] {
  return ENGINE_AMOUNTS[locale];
}

export function engineSlugs(locale: Locale): string[] {
  return engineAmounts(locale).map(engineSlug);
}

/** Сума сторінки за slug у мові; `undefined` — такої сторінки з движка немає. */
export function engineAmountOf(locale: Locale, slug: string): number | undefined {
  return engineAmounts(locale).find((amount) => engineSlug(amount) === slug);
}

export function engineLocalesOf(slug: string): Locale[] {
  return LOCALES.filter((locale) => engineAmountOf(locale, slug) !== undefined);
}

export function engineAlternates(locale: Locale, slug: string) {
  return answerAlternates(locale, slug, engineLocalesOf(slug));
}

const SUBFORMS: readonly Exclude<SubformId, 'kup20' | 'kup50'>[] = ['ryczalt', 'liniowy', 'skala'];

export function resolveEnginePage(locale: Locale, amount: number): ResolvedAnswerPage {
  const texts = ENGINE_TEXTS[locale];
  const answers = engineAnswers(amount);
  const jdg = calcJdg(answers);
  const uop = calcUop(answers);

  const sources = new Map<string, Source>();
  const shown = formatMoney(answers.monthlyRevenue);
  // Сума підставляється до типографіки: після неї «20 000 zł» уже не склеїти, і
  // заголовок рветься між числом і одиницею.
  const text = (t: string) => resolveText(t.replaceAll('{amount}', shown), sources);

  const title = text(texts.title);
  const description = text(texts.description);
  const lead = text(texts.lead);
  const assumptions = texts.assumptions.map((item) => text(item));

  // Джерела чисел таблиці: етап ZUS, кожна форма, трудовий договір.
  for (const source of assessZus(answers).sources) cite(sources, source);
  const rows: string[][] = [];
  for (const id of SUBFORMS) {
    const subform = jdg.subforms?.find((s) => s.id === id);
    const range: Range | null = subform?.available ? subform.rangeMonthly : null;
    rows.push([typeset(texts.rowLabels[id]), range ? formatRange(range) : typeset(texts.unavailable)]);
    for (const source of subform?.sources ?? []) cite(sources, source);
  }
  rows.push([typeset(texts.rowLabels.uop), uop.rangeMonthly ? formatRange(uop.rangeMonthly) : typeset(texts.unavailable)]);
  // UoP тягне й джерела статусу (захист UKR, право працювати): під числом
  // трудового договору вони нічого не підтверджують, а право вести JDG
  // цитує окремо припущення сторінки.
  for (const source of uop.sources) if (!source.ruleId.startsWith('status.')) cite(sources, source);

  const otherAmounts = engineAmounts(locale)
    .filter((other) => other !== amount)
    .map((other) => ({
      href: answerHref(locale, engineSlug(other)),
      text: typeset(texts.otherAmountsLabel.replace('{amount}', formatMoney(other))),
    }));
  const related = texts.related.map((item) => ({ href: answerHref(locale, item.to), text: typeset(item.text) }));

  const body: ResolvedBlock[] = [
    { kind: 'h2', text: typeset(texts.assumptionsTitle) },
    { kind: 'list', items: assumptions },
    { kind: 'h2', text: typeset(texts.resultTitle) },
    {
      kind: 'table',
      table: { caption: text(texts.tableCaption), head: texts.tableHead.map((h) => typeset(h)), rows },
    },
    { kind: 'p', text: text(texts.resultNote) },
    { kind: 'h2', text: typeset(texts.limitsTitle) },
    { kind: 'p', text: text(texts.limits) },
    { kind: 'h2', text: typeset(texts.seeAlsoTitle) },
    { kind: 'links', links: [...related, ...otherAmounts] },
  ];

  return {
    slug: engineSlug(amount),
    title,
    description,
    lead,
    body,
    sources: [...sources.values()],
    questionnaireHref: `${countryHref(locale, 'questionnaire')}?${encodePrefill(prefillOf(answers))}`,
    prefilled: true,
  };
}
