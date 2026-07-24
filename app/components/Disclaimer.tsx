import { t } from '@/lib/i18n/uk';
import styles from './Disclaimer.module.css';

/** Дисклеймер присутній на КОЖНОМУ екрані результату. */
export function Disclaimer() {
  return <p className={styles.disclaimer}>{t('app.disclaimer')}</p>;
}
