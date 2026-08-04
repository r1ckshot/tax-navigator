import { t } from '@/lib/i18n/uk';
import type { Risk } from '@/lib/calc/types';
import styles from './RiskBadge.module.css';

/**
 * Компактний чип рівня ризику (іконка + підпис). Колір ніколи не несе значення
 * сам: іконка + текст обовʼязкові (жовтий на світлому нижчий за 3:1, мітигація
 * саме в парі форма+текст). Пояснення «чому» живе окремо — серед пунктів у
 * розкритій картці.
 *
 * `compact` лишає на екрані саму іконку, а підпис ховає ВІЗУАЛЬНО (не з розмітки):
 * у заголовку картки поруч із назвою повний текст не вміщається, але читалка,
 * пошук по сторінці й тултип мусять його мати. Значення іконки видно в таблиці
 * порівняння — там та сама шкала підписана словами.
 */
const ICON: Record<Risk, string> = { green: '●', yellow: '▲', red: '■' };

export function RiskBadge({ risk, compact = false }: { risk: Risk; compact?: boolean }) {
  const label = t(`risk.${risk}`);

  return (
    <span
      className={styles.badge}
      data-risk={risk}
      data-compact={compact ? 'true' : undefined}
      title={compact ? label : undefined}
    >
      <span className={styles.icon} aria-hidden="true">
        {ICON[risk]}
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
