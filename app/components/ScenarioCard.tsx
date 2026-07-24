import { t } from '@/lib/i18n/uk';
import type { ScenarioResult } from '@/lib/calc/types';
import { RiskBadge } from './RiskBadge';
import { SourceCitation } from './SourceCitation';
import { formatRange } from './TakeHomeChart';
import styles from './ScenarioCard.module.css';

export function ScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{t(`scenario.${scenario.id}`)}</h3>

      <p className={styles.range} data-empty={scenario.rangeMonthly ? undefined : 'true'}>
        {scenario.rangeMonthly ? formatRange(scenario.rangeMonthly) : t('scenario.noRange')}
        {scenario.rangeMonthly && <span className={styles.unit}> {t('scenario.takeHome')}</span>}
      </p>

      <RiskBadge risk={scenario.risk} reason={scenario.riskReasonKey} />

      {scenario.subforms && (
        <ul className={styles.subforms}>
          {scenario.subforms.map((sub) => (
            <li key={sub.id}>
              <span className={styles.subformName}>{t(`subform.${sub.id}`)}</span>
              <span className={styles.subformValue}>
                {sub.available && sub.rangeMonthly
                  ? formatRange(sub.rangeMonthly)
                  : t(sub.unavailableReasonKey ?? 'scenario.unavailable')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {scenario.noteKeys.length > 0 && (
        <ul className={styles.notes}>
          {scenario.noteKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}

      <SourceCitation sources={scenario.sources} />
    </article>
  );
}
