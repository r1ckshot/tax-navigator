import { t } from '@/lib/i18n/uk';
import styles from './FreshnessBadge.module.css';

/**
 * Стан звірки правила. Та сама пара форма + текст, що в `RiskBadge`: колір
 * значення сам не несе, тож свіже й давнє відрізняються гліфом (`●` / `▲`) і
 * підписом. Зелений і жовтий узято з тих самих ролей, щоб шкала на сторінці
 * джерел читалась так само, як на екрані результату.
 */
export function FreshnessBadge({ stale }: { stale: boolean }) {
  return (
    <span className={styles.badge} data-stale={stale ? 'true' : 'false'}>
      <span className={styles.icon} aria-hidden="true">
        {stale ? '▲' : '●'}
      </span>
      <span className={styles.label}>{t(stale ? 'sources.stale' : 'sources.fresh')}</span>
    </span>
  );
}
