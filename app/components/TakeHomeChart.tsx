'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n/uk';
import type { Risk, ScenarioResult } from '@/lib/calc/types';
import styles from './TakeHomeChart.module.css';

const RISKS: Risk[] = ['green', 'yellow', 'red'];

export function TakeHomeChart({ scenarios }: { scenarios: ScenarioResult[] }) {
  const [showTable, setShowTable] = useState(false);

  // Шкала завжди від нуля — зрізана база перебільшила б різницю між варіантами.
  const maxValue = Math.max(...scenarios.map((s) => s.rangeMonthly?.max ?? 0), 1);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{t('chart.title')}</figcaption>

      <ul className={styles.rows}>
        {scenarios.map((s) => (
          <li key={s.id} className={styles.row}>
            <span className={styles.label}>{t(`scenario.${s.id}`)}</span>

            <span className={styles.track} aria-hidden="true">
              {s.rangeMonthly && (
                <span
                  className={styles.bar}
                  data-risk={s.risk}
                  style={{
                    left: `${(s.rangeMonthly.min / maxValue) * 100}%`,
                    width: `${((s.rangeMonthly.max - s.rangeMonthly.min) / maxValue) * 100}%`,
                  }}
                />
              )}
            </span>

            <span className={styles.value} data-empty={s.rangeMonthly ? undefined : 'true'}>
              {s.rangeMonthly ? formatRange(s.rangeMonthly) : t('scenario.noRange')}
            </span>
          </li>
        ))}
      </ul>

      <p className={styles.legend}>
        <span className={styles.legendTitle}>{t('chart.legend')}:</span>
        {RISKS.map((risk) => (
          <span key={risk} className={styles.legendItem}>
            <span className={styles.swatch} data-risk={risk} aria-hidden="true" />
            {t(`risk.${risk}`)}
          </span>
        ))}
      </p>

      <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
        {showTable ? t('chart.tableHide') : t('chart.tableView')}
      </button>

      {showTable && (
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
                <th scope="row">{t(`scenario.${s.id}`)}</th>
                <td>{s.rangeMonthly ? formatRange(s.rangeMonthly) : t('scenario.noRange')}</td>
                <td>{t(`risk.${s.risk}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

export function formatRange(range: { min: number; max: number }): string {
  return `${formatMoney(range.min)} – ${formatMoney(range.max)}`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Math.round(value));
}
