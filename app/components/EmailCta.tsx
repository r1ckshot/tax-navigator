import { t } from '@/lib/i18n/uk';
import styles from './EmailCta.module.css';

/**
 * Місце під CTA. Реального сабміту немає свідомо: конектор збору email —
 * окрема задача, і показувати неробочу форму було б гірше, ніж чесне «скоро».
 */
export function EmailCta() {
  return (
    <section className={styles.cta}>
      <h2>{t('cta.title')}</h2>
      <p>{t('cta.body')}</p>
      <p className={styles.soon}>{t('cta.soon')}</p>
    </section>
  );
}
