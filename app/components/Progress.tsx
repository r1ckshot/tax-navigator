'use client';

import { useT } from './I18nProvider';
import styles from './Progress.module.css';

/**
 * Плавна смуга прогресу. Число не показуємо: хвіст анкети умовний, тож точний
 * відсоток «стрибав» би від відповідей. Смугу стабілізуємо в самій сторінці
 * (не відкочується назад від зміни кількості екранів).
 */
export function Progress({ percent }: { percent: number }) {
  const t = useT();
  return (
    <div className={styles.wrap}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={t('progress.label')}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
