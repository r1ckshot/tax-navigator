import { t } from '@/lib/i18n/uk';
import type { ScenarioResult } from '@/lib/calc/types';
import { formatMoney, formatRange } from '@/lib/format';
import { RiskBadge } from './RiskBadge';
import { SourceCitation } from './SourceCitation';
import styles from './ScenarioCard.module.css';

/**
 * Акордеон-варіант: у згорнутому стані видно назву, рівень ризику й діапазон
 * «на руки». У розкритому — таблиця підформ (де є) і пояснення пунктами
 * (перший пункт — «чому» саме такий ризик), джерела списком.
 */
export function ScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  return (
    <details className={styles.card}>
      <summary className={styles.summary}>
        <span className={styles.head}>
          <span className={styles.title}>{t(`scenario.${scenario.id}`)}</span>
          <RiskBadge risk={scenario.risk} />
        </span>

        <span className={styles.range} data-empty={scenario.rangeMonthly ? undefined : 'true'}>
          {scenario.rangeMonthly ? (
            <>
              {formatRange(scenario.rangeMonthly)}
              <span className={styles.unit}>{t('scenario.takeHome')}</span>
            </>
          ) : (
            t(scenario.noRangeReasonKey ?? 'scenario.noRange')
          )}
        </span>

        <span className={styles.chevron} aria-hidden="true" />
      </summary>

      <div className={styles.body}>
        {scenario.subforms && (
          <table className={styles.subforms}>
            <tbody>
              {scenario.subforms.map((sub) => (
                <tr key={sub.id}>
                  <th scope="row" className={styles.subformName}>
                    {t(`subform.${sub.id}`)}
                  </th>
                  <td className={styles.subformValue} data-empty={sub.available && sub.rangeMonthly ? undefined : 'true'}>
                    {sub.available && sub.rangeMonthly
                      ? formatRange(sub.rangeMonthly)
                      : t(sub.unavailableReasonKey ?? 'scenario.unavailable')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {scenario.foreignBurden && (
          <>
            <p id="fop-burden-label" className={styles.burdenCaption}>
              {t('fop.burden.label')}
            </p>
            <table
              className={`${styles.subforms} ${styles.burdenTable}`}
              aria-labelledby="fop-burden-label"
            >
              <tbody>
                <tr>
                  <th scope="row" className={styles.subformName}>
                    {t('fop.burden.proportional')}
                  </th>
                  <td className={styles.subformValue}>
                    {formatRange(scenario.foreignBurden.proportionalMonthly)}{' '}
                    <span className={styles.burdenUnit}>{t('unit.zlMonth')}</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={styles.subformName}>
                    {t('fop.burden.esv')}
                  </th>
                  <td className={styles.subformValue}>
                    {formatMoney(scenario.foreignBurden.fixedMonthlyUah)}{' '}
                    <span className={styles.burdenUnit}>{t('unit.uahMonth')}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <ul className={styles.notes}>
          <li>{t(scenario.riskReasonKey)}</li>
          {scenario.noteKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>

        <SourceCitation sources={scenario.sources} />
      </div>
    </details>
  );
}
