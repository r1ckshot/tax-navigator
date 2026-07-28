import Link from 'next/link';
import { t } from '@/lib/i18n/uk';
import styles from './page.module.css';

export default function Home() {
  return (
    <main>
      <section className={styles.hero}>
        <h1>{t('app.title')}</h1>
        <p className={styles.intro}>{t('app.intro')}</p>
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
