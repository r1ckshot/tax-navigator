import Link from 'next/link';
import { t } from '@/lib/i18n/uk';
import { Disclaimer } from '@/components/Disclaimer';

export default function Home() {
  return (
    <main>
      <h1>{t('app.title')}</h1>
      <p>{t('app.intro')}</p>
      <p>
        <Link href="/questionnaire">
          <button type="button" data-variant="primary">
            {t('app.start')}
          </button>
        </Link>
      </p>
      <Disclaimer />
    </main>
  );
}
