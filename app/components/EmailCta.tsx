import { t } from '@/lib/i18n/uk';
import { waitlistHref } from '@/lib/waitlist';
import styles from './EmailCta.module.css';

/**
 * CTA листа очікування. Email збирає зовнішня форма за звичайним посиланням,
 * бо сервера в продукту немає (DECISIONS 2026-09-17). Поки форму не
 * налаштовано, лишається чесне «Скоро» замість неробочої кнопки.
 */
export function EmailCta({ href = waitlistHref() }: { href?: string | null }) {
  return (
    <section className={styles.cta}>
      <h2>{t('cta.title')}</h2>
      <p>{t('cta.body')}</p>
      {href ? (
        <>
          <p>{t('cta.invite')}</p>
          <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer">
            {t('cta.action')}
          </a>
        </>
      ) : (
        <p className={styles.soon}>{t('cta.soon')}</p>
      )}
    </section>
  );
}
