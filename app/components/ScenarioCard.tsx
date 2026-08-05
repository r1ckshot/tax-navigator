import { t } from '@/lib/i18n/uk';
import type { ScenarioResult } from '@/lib/calc/types';
import { formatMoney, formatRange } from '@/lib/format';
import { RiskBadge } from './RiskBadge';
import { SourceCitation } from './SourceCitation';
import styles from './ScenarioCard.module.css';

/**
 * Ділить назву на «все, крім останнього слова» і саме останнє слово. Іконка
 * ризику їде разом із останнім словом у нерозривному сегменті — інакше при
 * певних ширинах вона лишалась сама на новому рядку. Нерозривного пробілу для
 * цього мало: перед інлайн-блоком браузери трактують його по-різному.
 */
function splitTail(name: string): [string, string] {
  const lastSpace = name.lastIndexOf(' ');
  return lastSpace === -1 ? ['', name] : [name.slice(0, lastSpace + 1), name.slice(lastSpace + 1)];
}

/**
 * Акордеон-варіант: у згорнутому стані видно назву й рівень ризику (на широкому
 * ще й діапазон «чистими»). У розкритому — таблиця підформ (де є) і пояснення
 * пунктами (перший пункт — «чому» саме такий ризик), джерела списком.
 */
export function ScenarioCard({ scenario }: { scenario: ScenarioResult }) {
  const [nameHead, nameTail] = splitTail(t(`scenario.${scenario.id}`));

  return (
    <details className={styles.card}>
      <summary className={styles.summary}>
        <span className={styles.head}>
          {/*
           * Останнє слово назви разом з іконкою — в одному нерозривному
           * сегменті. Тому в довгих назвах на кшталт «Без реєстрації
           * (nierejestrowana)» іконка переноситься РАЗОМ із дужковою частиною
           * і за жодної ширини не лишається сама на новому рядку.
           *
           * Тільки іконка: повний підпис поруч із назвою не вміщається на
           * вузькому, а словами ту саму шкалу підписано в таблиці порівняння.
           */}
          <span className={styles.title}>
            {nameHead}
            <span className={styles.titleTail}>
              {nameTail}
              {'\u00A0'}
              <RiskBadge risk={scenario.risk} compact />
            </span>
          </span>
        </span>

        <span className={styles.range} data-empty={scenario.rangeMonthly ? undefined : 'true'}>
          {scenario.rangeMonthly ? (
            <>
              {formatRange(scenario.rangeMonthly)}
              <span className={styles.unit}>{t('scenario.takeHome')}</span>
            </>
          ) : (
            t(scenario.noRangeReasonKey ?? 'scenario.noRange')
          )}
        </span>

        <span className={styles.chevron} aria-hidden="true" />
      </summary>

      <div className={styles.body}>
        {scenario.subforms && (
          /* Той самий обведений блок, що й у тягаря: будь-яка таблиця чисел у
             картці читається як окремий предмет, а не як продовження прози. */
          <div className={styles.panel}>
            <table className={styles.subforms}>
              <tbody>
                {/*
                  * Таблиця лишається числовою: де суми немає — тире, і жодної прози.
                  * Причина йде першим пунктом у нотатки під таблицею. Доти вона
                  * стояла в комірці суми, тобто прозою в ЧИСЛОВІЙ колонці —
                  * вирівняною праворуч, з рваним лівим краєм на переносах, і через
                  * `width: max-content` розтягувала таблицю під найдовше речення,
                  * відриваючи числа решти підформ від їхніх назв.
                  */}
                {scenario.subforms.map((sub) => {
                  const hasNumber = sub.available && sub.rangeMonthly;
                  return (
                    <tr key={sub.id}>
                      <th scope="row" className={styles.subformName}>
                        {t(`subform.${sub.id}`)}
                      </th>
                      <td className={styles.subformValue} data-empty={hasNumber ? undefined : 'true'}>
                        {hasNumber ? formatRange(sub.rangeMonthly!) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {scenario.foreignBurden && (
          /*
           * Обведений блок, а не просто підпис над таблицею: ці дві суми —
           * витрата в ЧУЖІЙ юрисдикції, і без видимої межі вони читались як
           * продовження польських чисел картки, тобто як «на руки» (2026-08-03,
           * рев'ю Mike). Межа + фон + явний підпис лікуються разом.
           */
          <div className={`${styles.panel} ${styles.burden}`}>
            <p id="fop-burden-label" className={styles.burdenCaption}>
              {t('fop.burden.label')}
            </p>
            <table
              className={`${styles.subforms} ${styles.burdenTable}`}
              aria-labelledby="fop-burden-label"
            >
              <tbody>
                <tr>
                  <th scope="row" className={styles.subformName}>
                    {t('fop.burden.proportional')}
                  </th>
                  <td className={styles.subformValue}>
                    {formatRange(scenario.foreignBurden.proportionalMonthly)}{' '}
                    <span className={styles.burdenUnit}>{t('unit.zlMonth')}</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={styles.subformName}>
                    {t('fop.burden.esv')}
                  </th>
                  <td className={styles.subformValue}>
                    {formatMoney(scenario.foreignBurden.fixedMonthlyUah)}{' '}
                    <span className={styles.burdenUnit}>{t('unit.uahMonth')}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <ul className={styles.notes}>
          {/*
            * Причини недоступності — ПЕРШИМИ: тире в таблиці ставить питання, і
            * відповідь на нього має бути найближчим текстом, а не десь після
            * ризику й загальних нот. Кожен рядок сам називає підформу, бо поза
            * своїм рядком таблиці він її вже не має.
            */}
          {scenario.subforms
            ?.filter((sub) => !(sub.available && sub.rangeMonthly))
            .map((sub) => (
              <li key={`why-${sub.id}`} className={styles.noteUnavailable}>
                {t(sub.unavailableReasonKey ?? 'scenario.unavailable')}
              </li>
            ))}
          <li>{t(scenario.riskReasonKey)}</li>
          {scenario.noteKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>

        <SourceCitation sources={scenario.sources} />
      </div>
    </details>
  );
}
