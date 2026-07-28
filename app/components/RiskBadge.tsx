import { t } from '@/lib/i18n/uk';
import type { Risk } from '@/lib/calc/types';
import styles from './RiskBadge.module.css';

/**
 * Компактний чип рівня ризику (іконка + підпис) — для заголовка картки. Колір
 * ніколи не несе значення сам: іконка + текст обовʼязкові (жовтий на світлому
 * нижчий за 3:1, мітигація саме в парі форма+текст). Пояснення «чому» живе окремо
 * — серед пунктів у розкритій картці.
 */
const ICON: Record<Risk, string> = { green: '●', yellow: '▲', red: '■' };

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={styles.badge} data-risk={risk}>
      <span className={styles.icon} aria-hidden="true">
        {ICON[risk]}
      </span>
      {t(`risk.${risk}`)}
    </span>
  );
}
