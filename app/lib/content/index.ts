import type { Locale } from '@/lib/i18n';
import type { AnswerPageContent } from './types';
import { ryczaltIt } from './poland/uk-ryczalt-it';

export type { AnswerPageContent, Block } from './types';

/**
 * Реєстр сторінок-відповідей Польщі за мовою. Нова сторінка — файл у
 * `poland/` і рядок тут; адреса, sitemap і hreflang беруть список звідси.
 * Сторінка є лише в тих мовах, де її написано: перекладу «про запас» немає.
 */
export const ANSWER_PAGES: Record<Locale, readonly AnswerPageContent[]> = {
  uk: [ryczaltIt],
};

export function answerPage(locale: Locale, slug: string): AnswerPageContent | undefined {
  return ANSWER_PAGES[locale].find((page) => page.slug === slug);
}
