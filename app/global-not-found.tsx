import type { Metadata } from 'next';
import './globals.css';
import { DEFAULT_LOCALE, translator } from '@/lib/i18n';
import { countryHref } from '@/lib/routes';

/**
 * 404 для будь-якої адреси. Спільного кореневого layout немає — їх два,
 * `[locale]` і `(technical)` (ADR-0003), тож сторінка сама рендерить `<html>`.
 * Мова — за замовчуванням: з невідомої адреси мову не вгадати.
 */
const t = translator(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: `${t('notFound.title')} · ${t('app.title')}`,
};

export default function GlobalNotFound() {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <main>
          <h1>{t('notFound.title')}</h1>
          <p>{t('notFound.lead')}</p>
          <p>
            <a href={countryHref(DEFAULT_LOCALE)}>{t('notFound.home')}</a>
          </p>
        </main>
      </body>
    </html>
  );
}
