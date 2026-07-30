import { t } from '@/lib/i18n/uk';
import type { Risk, ScenarioResult } from '@/lib/calc/types';
import { formatRange } from '@/lib/format';
import styles from './ComparisonTable.module.css';

/**
 * Status-колір ніколи не несе значення сам: іконка + підпис обовʼязкові. Ризик —
 * окрема підписана колонка (іконка + текст). Смуг більше немає: величину «на руки»
 * несе саме число, а подвійне кодування (довжина + колір) лише збивало з пантелику.
 */
const RISK_ICON: Record<Risk, string> = { green: '●', yellow: '▲', red: '■' };

export function ComparisonTable({ scenarios }: { scenarios: ScenarioResult[] }) {
  return (
    <section className={styles.card} aria-labelledby="compare-heading">
      <h2 id="compare-heading">{t('scenarios.title')}</h2>
      <p className={styles.subtitle}>{t('scenarios.subtitle')}</p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('chart.col.scenario')}</th>
            <th scope="col">{t('chart.col.range')}</th>
            <th scope="col">{t('chart.col.risk')}</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.id}>
              <th scope="row" className={styles.name}>
                {t(`scenario.${s.id}`)}
              </th>

              <td className={styles.value} data-empty={s.rangeMonthly ? undefined : 'true'}>
                {s.rangeMonthly
                  ? formatRange(s.rangeMonthly)
                  : t(s.noRangeReasonKey ?? 'scenario.noRange')}
              </td>

              <td>
                <span className={styles.risk} data-risk={s.risk}>
                  <span className={styles.riskIcon} aria-hidden="true">
                    {RISK_ICON[s.risk]}
                  </span>
                  {t(`risk.${s.risk}`)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
