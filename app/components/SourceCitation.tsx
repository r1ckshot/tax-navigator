'use client';

import { useT } from './I18nProvider';
import type { Source } from '@/lib/rules/types';
import styles from './SourceCitation.module.css';

/** Цитата джерела на кожен висновок — тверда вимога product-safety. Список
 *  завжди видимий (не згорнутий), щоб джерела були на видноті, а не заховані. */
export function SourceCitation({ sources }: { sources: Source[] }) {
  const t = useT();
  if (sources.length === 0) return null;

  // Кілька правил часто стоять на одній сторінці (три ставки JDG — «Stawki i
  // limity»): людина бачить джерело, а не правило, тож і повтор рахується за ним.
  const unique = Array.from(new Map(sources.map((s) => [s.url + s.title, s])).values());

  return (
    <div className={styles.sources}>
      <span className={styles.label}>
        {t('app.sources')} ({unique.length}):
      </span>
      <ul className={styles.list}>
        {unique.map((s) => (
          <li key={s.url + s.title}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
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
