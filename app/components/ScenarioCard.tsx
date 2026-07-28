import { t } from '@/lib/i18n/uk';
import type { ScenarioResult } from '@/lib/calc/types';
import { formatRange } from '@/lib/format';
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
            t('scenario.noRange')
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
