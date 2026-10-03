import Link from 'next/link';
import type { Metadata } from 'next';
import { translator } from '@/lib/i18n';
import type { Direction } from './Showcase';
import styles from './page.module.css';

const t = translator('uk');

export const metadata: Metadata = { title: t('lab.title') };

const DIRECTIONS: Direction[] = ['a', 'b', 'c'];

/** Вхід для Mike: три посилання й по рядку про кожен напрям. */
export default function DesignLabIndex() {
  return (
    <main className={styles.main}>
      <h1>{t('lab.title')}</h1>
      <p className={styles.lead}>{t('lab.lead')}</p>
      <ol className={styles.list}>
        {DIRECTIONS.map((d) => (
          <li key={d}>
            <Link href={`/design-lab/${d}`} className={styles.card}>
              <span className={styles.letter}>{d.toUpperCase()}</span>
              <span className={styles.name}>{t(`lab.${d}.name`)}</span>
              <span className={styles.pitch}>{t(`lab.${d}.pitch`)}</span>
              <span className={styles.open}>{t('lab.open')} →</span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
