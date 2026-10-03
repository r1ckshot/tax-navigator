import type { Metadata } from 'next';
import { alternates } from '@/lib/routes';
import { resolveLocale, type LocaleParams } from '../../params';
import { Questionnaire } from './Questionnaire';

/**
 * Серверна обгортка лише заради метаданих: клієнтська сторінка їх не експортує.
 * Canonical — без query: share-лінк із відповідями не стає окремою сторінкою
 * для пошуку.
 */
export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  return { alternates: alternates(await resolveLocale(params), 'questionnaire') };
}

export default function QuestionnairePage() {
  return <Questionnaire />;
}
