import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n';

/** Параметри будь-якої сторінки під `[locale]`; у Next 15 вони приходять промісом. */
export type LocaleParams = Promise<{ locale: string }>;

/**
 * Мова з адреси. `dynamicParams = false` уже не пускає чужі мови, а перевірка
 * тут звужує тип для `translator()` і страхує, якщо прапор колись знімуть.
 */
export async function resolveLocale(params: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
