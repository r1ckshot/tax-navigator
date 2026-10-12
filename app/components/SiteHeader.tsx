'use client';

import Link from 'next/link';
import { brandHref, countryHref } from '@/lib/routes';
import { useLocale, useT } from './I18nProvider';
import { Wordmark } from './Wordmark';
import styles from './SiteHeader.module.css';

/**
 * Шапка-«титул» газети: знак ліворуч, дві адреси праворуч, лінійка чорнилом
 * під усім. Спільна для всіх сторінок продукту й 404.
 */
export function SiteHeader() {
  const t = useT();
  const locale = useLocale();
  return (
    <header className={styles.bar}>
      <Link href={brandHref(locale)} className={styles.home} aria-label={t('brand.home')}>
        <Wordmark />
      </Link>
      <nav className={styles.nav} aria-label={t('brand.nav')}>
        <Link href={countryHref(locale)}>{t('brand.poland')}</Link>
        <Link href={countryHref(locale, 'sources')}>{t('app.sources')}</Link>
      </nav>
    </header>
  );
}
