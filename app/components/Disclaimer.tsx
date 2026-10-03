'use client';

import { useT } from './I18nProvider';
import styles from './Disclaimer.module.css';

/** Дисклеймер присутній на КОЖНОМУ екрані результату. */
export function Disclaimer() {
  const t = useT();
  return <p className={styles.disclaimer}>{t('app.disclaimer')}</p>;
}
