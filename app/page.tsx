import { Fragment } from 'react';
import Link from 'next/link';
import { t } from '@/lib/i18n/uk';
import type { ScenarioId } from '@/lib/calc/types';
import styles from './page.module.css';

/** Ті самі пʼять сценаріїв і в тому ж порядку, що й у таблиці результату. */
const SCENARIOS: ScenarioId[] = ['fop', 'jdg', 'incubator', 'zlecenie', 'uop'];

const ARROW = '↔';

/**
 * Заголовок із акцентованою стрілкою. Розбивається тут, а не в i18n: `app.title`
 * має лишатись цілим рядком, бо той самий ключ іде в `metadata.title`, де
 * розмітки бути не може. Якщо стрілку колись приберуть із назви — рендеримо
 * заголовок як є, без падіння.
 */
function Title() {
  const parts = t('app.title').split(ARROW);
  if (parts.length !== 2) return <h1>{t('app.title')}</h1>;

  return (
    <h1>
      {parts[0]}
      <span className={styles.arrow}>{ARROW}</span>
      {parts[1]}
    </h1>
  );
}

export default function Home() {
  return (
    <main>
      <section className={styles.hero}>
        <Title />
        <p className={styles.lead}>{t('app.lead')}</p>
        <p className={styles.intro}>{t('app.intro')}</p>
        <ul className={styles.scenarios}>
          {SCENARIOS.map((id, i) => (
            <Fragment key={id}>
              <li>{t(`scenario.${id}`)}</li>
              {/* Розрив рядка на вузькому екрані: 3 + 2. Порожній елемент, а не
                  стиль на самому пункті — flex ламає рядок лише окремим item-ом. */}
              {i === 2 && <li className={styles.scenariosBreak} aria-hidden="true" />}
            </Fragment>
          ))}
        </ul>
        <p className={styles.cta}>
          <Link href="/questionnaire">
            <button type="button" data-variant="primary">
              {t('app.start')}
            </button>
          </Link>
        </p>
      </section>
    </main>
  );
}
