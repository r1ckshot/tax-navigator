'use client';

import type { CSSProperties } from 'react';
import { useT } from './I18nProvider';
import type { Risk, ScenarioResult } from '@/lib/calc/types';
import { formatRange } from '@/lib/format';
import motion from './Motion.module.css';
import ruled from './Ruled.module.css';
import styles from './ComparisonTable.module.css';

const at = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * Status-колір ніколи не несе значення сам: іконка + підпис обовʼязкові. Ризик —
 * окрема підписана колонка (іконка + текст). Смуг більше немає: величину «на руки»
 * несе саме число, а подвійне кодування (довжина + колір) лише збивало з пантелику.
 */
const RISK_ICON: Record<Risk, string> = { green: '●', yellow: '▲', red: '■' };

/**
 * Усі шість варіантів рівноважні: рядок без числа відрізняється лише типографікою,
 * а не позицією чи окремим блоком (DECISIONS 2026-08-04). Порядок фіксований для
 * будь-якого профілю — інакше склад «головної» таблиці залежав би від відповідей,
 * і це читалось би як рекомендація.
 *
 * Нижче 40rem рядки стають картками (CSS), тож `role`-и проставлені явно: при
 * `display: block` браузер губить неявні ролі таблиці, і читалка перестала б
 * звʼязувати число з колонкою. Підпис колонки дублюється в кожній картці —
 * `aria-hidden`, бо для читалки звʼязок дає сама шапка.
 *
 * Рух — лише заголовок і підзаголовок. Таблиця з сумами й ризиком стоїть із
 * першого кадру, і жоден рядок не рухається окремо: черговість появи читалась
 * би як рейтинг (DECISIONS 2026-10-12).
 */
export function ComparisonTable({ scenarios }: { scenarios: ScenarioResult[] }) {
  const t = useT();
  return (
    <section className={`${ruled.inkRule} ${ruled.sheet} ${styles.card}`} aria-labelledby="compare-heading">
      <h2 id="compare-heading" className={motion.soft} style={at(3)}>
        {t('scenarios.title')}
      </h2>
      <p className={`${motion.soft} ${styles.subtitle}`} style={at(4)}>
        {t('scenarios.subtitle')}
      </p>

      <table className={styles.table} role="table">
        <thead>
          <tr role="row">
            <th scope="col" role="columnheader">
              {t('chart.col.scenario')}
            </th>
            <th scope="col" role="columnheader">
              {t('chart.col.range')}
            </th>
            <th scope="col" role="columnheader">
              {t('chart.col.risk')}
            </th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.id} role="row" className={styles.row}>
              <th scope="row" role="rowheader" className={styles.name}>
                {t(`scenario.${s.id}`)}
              </th>

              <td role="cell" className={styles.value} data-empty={s.rangeMonthly ? undefined : 'true'}>
                {s.rangeMonthly ? (
                  <>
                    {/* Сума нерозривна сама по собі — по тире вона не рветься. */}
                    <span className={styles.amount}>{formatRange(s.rangeMonthly)}</span>
                    {/* Підпис колонки — під числом, дрібним кеглем: на телефоні
                        шапки не видно. Для читалки `aria-hidden`, бо звʼязок
                        дає сама шапка. */}
                    <span className={styles.stackedLabel} aria-hidden="true">
                      {t('chart.col.range')}
                    </span>
                  </>
                ) : (
                  t(s.noRangeReasonKey ?? 'scenario.noRange')
                )}
              </td>

              <td role="cell">
                <span className={styles.risk} data-risk={s.risk}>
                  <span className={styles.riskIcon} aria-hidden="true">
                    {RISK_ICON[s.risk]}
                  </span>
                  {/* На ПК над колонкою шапка «Юридичний ризик», тож у комірці
                      лише рівень. На телефоні шапки не видно — повний текст.
                      Прихований варіант — `display: none`, тож читалка чує один. */}
                  <span className={styles.riskLong}>{t(`risk.${s.risk}`)}</span>
                  <span className={styles.riskShort}>{t(`risk.short.${s.risk}`)}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Що означає колонка ризику: сам підпис «Юридичний ризик» читався як оцінка
 * вигоди («що я отримаю?» — Mike, 2026-08-04). Той самий клас помилки, що й
 * український тягар: позначка дає хибний висновок, і жоден тест цього не бачить.
 *
 * Окремий блок, а не рядок у картці таблиці: на телефоні він іде одразу під
 * таблицею (порядок розмітки), а на ПК стоїть під вердиктом поруч із нею і
 * вирівнює дві колонки за висотою.
 */
export function RiskNote() {
  const t = useT();
  return (
    <aside className={`${ruled.inkRule} ${ruled.sheet} ${styles.riskNote}`} aria-label={t('chart.col.risk')}>
      <p>{t('scenarios.riskNote')}</p>
    </aside>
  );
}
