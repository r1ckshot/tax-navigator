import type { Metadata } from 'next';
import Link from 'next/link';
import { translator, type Translate } from '@/lib/i18n';
import type { ScenarioId } from '@/lib/calc/types';
import { alternates, countryHref } from '@/lib/routes';
import { resolveLocale, type LocaleParams } from '../params';
import styles from './page.module.css';

/** Ті самі шість сценаріїв і в тому ж порядку, що й у таблиці результату. */
const SCENARIOS: ScenarioId[] = ['fop', 'jdg', 'incubator', 'nierejestrowana', 'zlecenie', 'uop'];

const ARROW = '↔';

/**
 * Заголовок із акцентованою стрілкою. Розбивається тут, а не в i18n: `app.title`
 * має лишатись цілим рядком, бо той самий ключ іде в `metadata.title`, де
 * розмітки бути не може. Якщо стрілку колись приберуть із назви — рендеримо
 * заголовок як є, без падіння.
 */
function Title({ t }: { t: Translate }) {
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

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  return { alternates: alternates(await resolveLocale(params)) };
}

export default async function Home({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const t = translator(locale);

  return (
    <main>
      <section className={styles.hero}>
        <Title t={t} />
        <p className={styles.lead}>{t('app.lead')}</p>
        <p className={styles.intro}>{t('app.intro')}</p>
        <ul className={styles.scenarios}>
          {SCENARIOS.map((id) => (
            <li key={id}>{t(`scenario.${id}`)}</li>
          ))}
        </ul>
        <p className={styles.cta}>
          <Link href={countryHref(locale, 'questionnaire')}>
            <button type="button" data-variant="primary">
              {t('app.start')}
            </button>
          </Link>
        </p>
        <p className={styles.trust}>
          {t('app.trust')}
          <Link href={countryHref(locale, 'sources')}>{t('sources.link')}</Link>
        </p>
      </section>
    </main>
  );
}
