'use client';

import { useT } from './I18nProvider';
import { waitlistHref } from '@/lib/waitlist';
import button from './Button.module.css';
import ruled from './Ruled.module.css';
import styles from './EmailCta.module.css';

/**
 * CTA листа очікування. Email збирає зовнішня форма за звичайним посиланням,
 * бо сервера в продукту немає (DECISIONS 2026-09-17). Поки форму не
 * налаштовано, лишається чесне «Скоро» замість неробочої кнопки.
 *
 * Кнопка другорядна (рамкою): заповнена на екрані результату одна — «Поділитися».
 */
export function EmailCta({ href = waitlistHref() }: { href?: string | null }) {
  const t = useT();
  return (
    <section className={`${ruled.inkEdge} ${ruled.sheet} ${styles.cta}`}>
      <h2>{t('cta.title')}</h2>
      <p>{t('cta.body')}</p>
      {href ? (
        <>
          <p>{t('cta.invite')}</p>
          <a className={`${button.secondary} ${button.arrow} ${styles.action}`} href={href} target="_blank" rel="noopener noreferrer">
            {t('cta.action')}
          </a>
        </>
      ) : (
        <p className={styles.soon}>{t('cta.soon')}</p>
      )}
    </section>
  );
}
