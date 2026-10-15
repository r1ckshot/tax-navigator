import type { Metadata } from 'next';
import './globals.css';
import { DEFAULT_LOCALE, translator } from '@/lib/i18n';
import button from '@/components/Button.module.css';
import { SiteHeader } from '@/components/SiteHeader';
import { brandHref } from '@/lib/routes';
import { fontFaces } from './fonts';

/**
 * 404 для будь-якої адреси. Спільного кореневого layout немає — їх два,
 * `[locale]` і `(technical)` (ADR-0003), тож сторінка сама рендерить `<html>`.
 * Мова — за замовчуванням: з невідомої адреси мову не вгадати.
 */
const t = translator(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: t('notFound.title'),
};

export default function GlobalNotFound() {
  return (
    <html lang={DEFAULT_LOCALE} style={fontFaces}>
      <body>
        <SiteHeader />
        <main>
          <h1>{t('notFound.title')}</h1>
          <p>{t('notFound.lead')}</p>
          <p>
            <a className={`${button.primary} ${button.arrow}`} href={brandHref(DEFAULT_LOCALE)}>
              {t('notFound.home')}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
