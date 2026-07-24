import { t } from '@/lib/i18n/uk';
import styles from './Progress.module.css';

/**
 * Відсоток, а не «крок N з 10»: хвіст анкети умовний, тож фіксована
 * кількість кроків була б неправдою.
 */
export function Progress({ current, total }: { current: number; total: number }) {
  const percent = Math.round((current / total) * 100);
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
      <span className={styles.value}>{percent}%</span>
    </div>
  );
}
