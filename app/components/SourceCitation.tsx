import { t } from '@/lib/i18n/uk';
import type { Source } from '@/lib/rules/types';
import styles from './SourceCitation.module.css';

/** Цитата джерела на кожен висновок — тверда вимога product-safety. */
export function SourceCitation({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  const unique = Array.from(new Map(sources.map((s) => [s.url + s.ruleId, s])).values());

  return (
    <details className={styles.details}>
      <summary>
        {t('app.sources')} ({unique.length})
      </summary>
      <ul className={styles.list}>
        {unique.map((s) => (
          <li key={s.ruleId + s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.ruleId}
            </a>
            <span className={styles.meta}>
              {' '}
              — {t('app.verifiedAt')} {s.verifiedAt}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
