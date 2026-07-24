import { t } from '@/lib/i18n/uk';
import type { ResidencyResult } from '@/lib/calc/types';
import { SourceCitation } from './SourceCitation';
import styles from './ResidencyVerdict.module.css';

export function ResidencyVerdict({ result }: { result: ResidencyResult }) {
  return (
    <section className={styles.card} aria-labelledby="residency-heading">
      <h2 id="residency-heading">{t('residency.title')}</h2>

      <p className={styles.verdict}>
        {t(result.plResident ? 'residency.plResident' : 'residency.plNonResident')}
      </p>

      {result.basis.length > 0 ? (
        <ul className={styles.basis}>
          {result.basis.map((b) => (
            <li key={b}>{t(`residency.basis.${b}`)}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>{t('residency.noBasis')}</p>
      )}

      {result.dualRisk && result.tiebreak && (
        <div className={styles.tiebreak}>
          <p>{t('residency.dualRisk')}</p>
          <p>{t(`residency.tiebreak.${result.tiebreak.resolvedAt}`)}</p>
          <p className={styles.note}>{t(`residency.tiebreak.result.${result.tiebreak.result}`)}</p>
        </div>
      )}

      {result.sunsetNote && <p className={styles.sunset}>{t('residency.sunset')}</p>}

      <SourceCitation sources={result.sources} />
    </section>
  );
}
