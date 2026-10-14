'use client';

import type { CSSProperties } from 'react';
import { useT } from './I18nProvider';
import type { ResidencyResult } from '@/lib/calc/types';
import { SourceCitation } from './SourceCitation';
import motion from './Motion.module.css';
import ruled from './Ruled.module.css';
import styles from './ResidencyVerdict.module.css';

const at = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * Верхній край — лінійка чорнилом, що прокреслюється (Ruled.module.css);
 * заголовок і вердикт проявляються по черзі. Решта — підстави, джерела —
 * стоїть із першого кадру: це вже документ, а не подія.
 */
export function ResidencyVerdict({ result }: { result: ResidencyResult }) {
  const t = useT();
  return (
    <section className={`${ruled.inkRule} ${ruled.sheet} ${styles.card}`} aria-labelledby="residency-heading">
      <h2 id="residency-heading" className={motion.soft} style={at(2)}>
        {t('residency.title')}
      </h2>

      <p className={`${motion.soft} ${styles.verdict}`} style={at(3)}>
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

      {/* Джерела — внизу картки: на ПК вона тягнеться на висоту порівняння поруч. */}
      <div className={styles.foot}>
        <SourceCitation sources={result.sources} />
      </div>
    </section>
  );
}
