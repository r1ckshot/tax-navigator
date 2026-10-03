'use client';

import { useT } from './I18nProvider';
import type { Source } from '@/lib/rules/types';
import styles from './SourceCitation.module.css';

/** Цитата джерела на кожен висновок — тверда вимога product-safety. Список
 *  завжди видимий (не згорнутий), щоб джерела були на видноті, а не заховані. */
export function SourceCitation({ sources }: { sources: Source[] }) {
  const t = useT();
  if (sources.length === 0) return null;

  const unique = Array.from(new Map(sources.map((s) => [s.url + s.ruleId, s])).values());

  return (
    <div className={styles.sources}>
      <span className={styles.label}>
        {t('app.sources')} ({unique.length}):
      </span>
      <ul className={styles.list}>
        {unique.map((s) => (
          <li key={s.ruleId + s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.ruleId}
            </a>
            {/* Тире живе в окремому span: на телефоні дата йде своїм рядком, і
                тоді розділовий знак посеред рядка не потрібен. */}
            <span className={styles.meta}>
              <span className={styles.dash}> — </span>
              {t('app.verifiedAt')} {s.verifiedAt}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
