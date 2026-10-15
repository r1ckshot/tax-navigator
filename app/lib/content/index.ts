import type { Locale } from '@/lib/i18n';
import type { AnswerPageContent } from './types';
import { b2bNaRuky } from './poland/uk-b2b-na-ruky';
import { fopChyJdg } from './poland/uk-fop-chy-jdg';
import { jdgUkrCukr } from './poland/uk-jdg-ukr-cukr';
import { pilgovyiZus } from './poland/uk-pilgovyi-zus';
import { pipB2b } from './poland/uk-pip-b2b';
import { rezydentstvoBank } from './poland/uk-rezydentstvo-bank';
import { ryczaltIt } from './poland/uk-ryczalt-it';
import { vatJdg } from './poland/uk-vat-jdg';

export type { AnswerPageContent, Block } from './types';

/**
 * Реєстр сторінок-відповідей Польщі за мовою. Нова сторінка — файл у
 * `poland/` і рядок тут; адреса, sitemap і hreflang беруть список звідси.
 * Сторінка є лише в тих мовах, де її написано: перекладу «про запас» немає.
 * Порядок — за кількістю питань теми в чатах (questions-2026-09.md), далі
 * пошукові теми без лічильника.
 */
export const ANSWER_PAGES: Record<Locale, readonly AnswerPageContent[]> = {
  uk: [jdgUkrCukr, rezydentstvoBank, vatJdg, pipB2b, pilgovyiZus, fopChyJdg, b2bNaRuky, ryczaltIt],
};

export function answerPage(locale: Locale, slug: string): AnswerPageContent | undefined {
  return ANSWER_PAGES[locale].find((page) => page.slug === slug);
}
