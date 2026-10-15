import type { Metadata } from 'next';
import { translator } from '@/lib/i18n';
import { alternates } from '@/lib/routes';
import { resolveLocale, type LocaleParams } from '../../params';
import { Questionnaire } from './Questionnaire';

/**
 * Серверна обгортка лише заради метаданих: клієнтська сторінка їх не експортує.
 * Canonical — без query: share-лінк із відповідями не стає окремою сторінкою
 * для пошуку.
 */
export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = translator(locale);
  return {
    title: t('questionnaire.title'),
    alternates: alternates(locale, 'questionnaire'),
  };
}

export default function QuestionnairePage() {
  return <Questionnaire />;
}
