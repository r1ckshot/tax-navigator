import { t } from '@/lib/i18n/uk';
import type { Risk, ScenarioResult } from '@/lib/calc/types';
import { formatRange } from '@/lib/format';
import styles from './ComparisonTable.module.css';

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
 */
export function ComparisonTable({ scenarios }: { scenarios: ScenarioResult[] }) {
  return (
    <section className={styles.card} aria-labelledby="compare-heading">
      <h2 id="compare-heading">{t('scenarios.title')}</h2>
      <p className={styles.subtitle}>{t('scenarios.subtitle')}</p>

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

              <td
                role="cell"
                className={styles.value}
                data-empty={s.rangeMonthly ? undefined : 'true'}
              >
                {s.rangeMonthly ? (
                  <>
                    {/* Сума нерозривна сама по собі — по тире вона не рветься. */}
                    <span className={styles.amount}>{formatRange(s.rangeMonthly)}</span>
                    {/*
                     * Єдина дозволена точка розриву рядка — саме тут, між сумою
                     * і підписом. `<wbr>`, а не пробіл: пробіл узявся б кеглем
                     * суми й розсунув пару, а проміжок уже дає margin підпису.
                     * Без цього розриву найширше число разом із підписом не
                     * влазило в 375px, і екран результату їхав горизонтально.
                     */}
                    <wbr />
                    {/* Підпис колонки — одразу за числом, дрібним кеглем: на
                        телефоні шапки не видно. Для читалки `aria-hidden`,
                        бо звʼязок дає сама шапка. */}
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
                  {t(`risk.${s.risk}`)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
       * Що означає колонка ризику, сказано прямо під таблицею: сам підпис
       * «Юридичний ризик» читався як оцінка вигоди («що я отримаю?» — Mike,
       * 2026-08-04). Той самий клас помилки, що й український тягар: число (чи
       * позначка) дає хибний висновок, і жоден тест цього не бачить.
       */}
      <p className={styles.riskNote}>{t('scenarios.riskNote')}</p>
    </section>
  );
}
