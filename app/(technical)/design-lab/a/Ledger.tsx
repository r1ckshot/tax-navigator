'use client';

import type { CSSProperties } from 'react';
import { useT } from '@/components/I18nProvider';
import type { ScenarioResult } from '@/lib/calc/types';
import { formatRange } from '@/lib/format';
import styles from './Ledger.module.css';

/**
 * Анімація напряму A: рядки реєстру проявляються по черзі, лінійка під кожним
 * прокреслюється зліва направо. Порядок — фіксований порядок варіантів, як у
 * таблиці: черговість появи не має читатись як рейтинг. Затримку дає індекс
 * рядка в CSS (`--i`), таймерів немає.
 */
export function Ledger({ scenarios }: { scenarios: ScenarioResult[] }) {
  const t = useT();
  return (
    <div className={styles.ledger}>
      <p className={styles.head}>
        <span>{t('chart.col.scenario')}</span>
        <span>{t('chart.col.range')}</span>
      </p>
      <ul>
        {scenarios.map((s, i) => (
          <li key={s.id} style={{ '--i': i } as CSSProperties}>
            <span className={styles.name}>{t(`scenario.${s.id}`)}</span>
            <span className={styles.value}>
              {s.rangeMonthly ? formatRange(s.rangeMonthly) : t(s.noRangeReasonKey ?? 'scenario.noRange')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
