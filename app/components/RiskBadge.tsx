import { t } from '@/lib/i18n/uk';
import type { Risk } from '@/lib/calc/types';
import styles from './RiskBadge.module.css';

/**
 * Status-колір ніколи не несе значення сам. На світлій поверхні жовтий
 * навмисне нижчий за 3:1 — мітигація саме в парі «іконка + підпис»,
 * тому вони тут обовʼязкові, а не декоративні.
 */
const ICON: Record<Risk, string> = { green: '●', yellow: '▲', red: '■' };

export function RiskBadge({ risk, reason }: { risk: Risk; reason?: string }) {
  return (
    <p className={styles.badge} data-risk={risk}>
      <span className={styles.icon} aria-hidden="true">
        {ICON[risk]}
      </span>
      <span>
        <strong>{t(`risk.${risk}`)}</strong>
        {reason ? <> — {t(reason)}</> : null}
      </span>
    </p>
  );
}
