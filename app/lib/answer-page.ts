import { ruleDate, ruleNumber } from '@/lib/calc/facts';
import { sourceOf, type Source } from '@/lib/rules/types';
import { ANSWER_PAGES, type AnswerPageContent, type Block } from '@/lib/content';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { LOCALES, type Locale } from '@/lib/i18n';
import { typeset } from '@/lib/i18n/typeset';
import { answerAlternates, answerHref, countryHref } from '@/lib/routes';
import { encodePrefill } from '@/lib/share';

/**
 * Збирає сторінку-відповідь із файла змісту: плейсхолдери → числа з правил,
 * джерела всіх використаних правил, посилання в анкету з передзаповненням.
 * Шаблон (`app/[locale]/poland/[slug]/page.tsx`) отримує готові рядки й нічого
 * не рахує.
 */

/** `{{amount:jdg.ryczalt.rate/annualLimit}}` — формат, правило, шлях у `params`. */
const PLACEHOLDER = /\{\{(\w+):([a-z0-9_.]+)\/([A-Za-z0-9_.]+)\}\}/g;

/**
 * `{{cite:jdg.byly_pracodawca}}` — твердження без числа теж має джерело: маркер
 * нічого не друкує, лише додає правило в блок джерел. Пробіл перед ним зʼїдається.
 */
const CITE = /\s*\{\{cite:([a-z0-9_.]+)\}\}/g;

const FORMATS: Record<string, (value: number) => string> = {
  amount: formatAmount,
  percent: formatPercent,
};

/** `{{date:status.ukr_protection/protectionUntil}}` → «04.03.2028»: дата з правила, не з тексту. */
const DATE_FORMAT = 'date';

export interface ResolvedLink {
  href: string;
  text: string;
}

export interface ResolvedTable {
  caption: string;
  head: string[];
  rows: string[][];
}

/**
 * `table` і `links` вже без плейсхолдерів: таблицю будує лише движок
 * (`engine-page.ts`), посилання — з файла змісту через `answerHref`.
 */
export interface ResolvedBlock {
  kind: Block['kind'] | 'table';
  text?: string;
  items?: string[];
  links?: ResolvedLink[];
  table?: ResolvedTable;
}

export interface ResolvedAnswerPage {
  slug: string;
  title: string;
  description: string;
  lead: string;
  body: ResolvedBlock[];
  /** Джерело кожного числа на сторінці, кожне один раз, у порядку появи. */
  sources: Source[];
  questionnaireHref: string;
  /** Чи несе кнопка відповіді з теми сторінки: від цього залежить текст біля неї. */
  prefilled: boolean;
  guide?: string;
}

/** Людина бачить джерело, а не правило: два правила з однієї сторінки — один рядок. */
export function cite(sources: Map<string, Source>, source: Source): void {
  const key = source.url + source.title;
  if (!sources.has(key)) sources.set(key, source);
}

/** Плейсхолдер → відформатоване число; джерело дописується в `sources`. */
export function resolveText(text: string, sources: Map<string, Source>): string {
  const citeTo = (source: Source) => cite(sources, source);
  const resolved = text
    .replace(CITE, (_match, ruleId: string) => {
      citeTo(sourceOf(ruleId));
      return '';
    })
    .replace(PLACEHOLDER, (_match, format: string, ruleId: string, path: string) => {
      if (format === DATE_FORMAT) {
        const { value, source } = ruleDate(ruleId, path);
        citeTo(source);
        return formatDate(value);
      }
      const formatter = FORMATS[format];
      if (!formatter) throw new Error(`Unknown number format "${format}" in {{${format}:${ruleId}/${path}}}`);
      const { value, source } = ruleNumber(ruleId, path);
      citeTo(source);
      return formatter(value);
    });
  if (resolved.includes('{{')) throw new Error(`Malformed placeholder in: ${text}`);
  return typeset(resolved);
}

export function resolveAnswerPage(locale: Locale, content: AnswerPageContent): ResolvedAnswerPage {
  const sources = new Map<string, Source>();
  const text = (t: string) => resolveText(t, sources);
  const prefilled = Object.keys(content.prefill).length > 0;
  // Порядок збірки — порядок читання: джерело, вперше назване в заголовку чи
  // вступі, стоїть у блоці джерел раніше за джерела тіла.
  const title = text(content.title);
  const description = text(content.description);
  const lead = text(content.lead);
  const body = content.body.map((block): ResolvedBlock => {
    switch (block.kind) {
      case 'list':
        return { kind: 'list', items: block.items.map(text) };
      case 'links':
        return { kind: 'links', links: block.items.map((item) => ({ href: answerHref(locale, item.to), text: text(item.text) })) };
      default:
        return { kind: block.kind, text: text(block.text) };
    }
  });
  return {
    slug: content.slug,
    title,
    description,
    lead,
    body,
    sources: [...sources.values()],
    // Без відповідей із теми — звичайна анкета: позначка `start=1` без відповідей
    // нічого не передзаповнює, а лише лишилась би в адресі.
    questionnaireHref: prefilled
      ? `${countryHref(locale, 'questionnaire')}?${encodePrefill(content.prefill)}`
      : countryHref(locale, 'questionnaire'),
    prefilled,
    guide: content.guide,
  };
}

/** Мови, в яких сторінку написано, — для hreflang і sitemap. */
export function localesOf(slug: string): Locale[] {
  return LOCALES.filter((l) => ANSWER_PAGES[l].some((page) => page.slug === slug));
}

export function answerPageAlternates(locale: Locale, slug: string) {
  return answerAlternates(locale, slug, localesOf(slug));
}

/**
 * Посилання на норму («art. 8 ust. 2», «art. 22 § 1», «ст. 8») — адреса в
 * законі, а не число для читача; guard їх пропускає. Усе інше з цифрою — літерал.
 */
// `\b` не бачить кирилиці, тож межа слова — через `\p{L}`.
const LEGAL_REFERENCE = /(?<!\p{L})(?:art\.|ust\.|pkt|ст\.|ч\.|п\.|§)\s*\d+\p{Ll}*/giu;

/** Назви, де цифра — частина слова, а не число: «B2B». Список закритий, щоб guard не слабшав. */
const NAMES_WITH_DIGITS = /(?<![\p{L}\d])B2B(?![\p{L}\d])/gu;

/**
 * Цифри в тексті змісту поза плейсхолдерами. Порожньо — кожне число сторінки
 * прийшло з правила; інакше — список літералів для повідомлення тесту.
 */
export function numberLiterals(text: string): string[] {
  const stripped = text.replace(CITE, '').replace(PLACEHOLDER, '').replace(LEGAL_REFERENCE, '').replace(NAMES_WITH_DIGITS, '');
  return stripped.match(/\d[\d\s.,]*/g)?.map((m) => m.trim()) ?? [];
}

/** Усі рядки змісту — для guard-тесту і рев'ю текстів. */
export function contentStrings(content: AnswerPageContent): string[] {
  return [
    content.title,
    content.description,
    content.lead,
    ...content.body.flatMap((b) => (b.kind === 'list' ? b.items : b.kind === 'links' ? b.items.map((i) => i.text) : [b.text])),
  ];
}
