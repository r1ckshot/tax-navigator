'use client';

import type { CSSProperties } from 'react';
import { useT } from '@/components/I18nProvider';
import type { ScenarioResult } from '@/lib/calc/types';
import { formatRange } from '@/lib/format';
import styles from './Readout.module.css';

const DIGITS = '01234567890123456789'.split('');

/**
 * Барабан лічильника для однієї цифри: стрічка 0–9 двічі, зупиняється на
 * другому колі (`--d`), тож кожен барабан робить щонайменше один оберт. Цифра
 * йде в CSS як є — сторінка нічого не рахує. Для читалки барабан прихований,
 * значення дає текст поруч.
 */
function Reels({ text, row }: { text: string; row: number }) {
  return (
    <span className={styles.reels} aria-hidden="true">
      {[...text].map((ch, k) =>
        /\d/.test(ch) ? (
          <span key={k} className={styles.reel} style={{ '--d': ch, '--i': row, '--k': k } as CSSProperties}>
            <span className={styles.strip}>
              {DIGITS.map((d, j) => (
                <span key={j}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={k}>{ch}</span>
        ),
      )}
    </span>
  );
}

/**
 * Анімація напряму B: шість показників приладу у фіксованому порядку варіантів.
 * Барабани зупиняються зліва направо й згори вниз — черговість задає позиція
 * рядка, а не величина, тож ніщо не «виграє» першим.
 */
export function Readout({ scenarios }: { scenarios: ScenarioResult[] }) {
  const t = useT();
  return (
    <div className={styles.readout}>
      <p className={styles.head}>{t('chart.col.range')}</p>
      <ul>
        {scenarios.map((s, i) => {
          const value = s.rangeMonthly ? formatRange(s.rangeMonthly) : null;
          return (
            <li key={s.id}>
              <span className={styles.name}>{t(`scenario.${s.id}`)}</span>
              {value ? (
                <span className={styles.value}>
                  <Reels text={value} row={i} />
                  <span className={styles.srOnly}>{value}</span>
                </span>
              ) : (
                <span className={styles.empty}>{t(s.noRangeReasonKey ?? 'scenario.noRange')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
