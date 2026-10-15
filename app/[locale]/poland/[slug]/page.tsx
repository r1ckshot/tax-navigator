import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Disclaimer } from '@/components/Disclaimer';
import button from '@/components/Button.module.css';
import ruled from '@/components/Ruled.module.css';
import { answerPageAlternates, resolveAnswerPage, type ResolvedAnswerPage } from '@/lib/answer-page';
import { ANSWER_PAGES, answerPage } from '@/lib/content';
import { formatDate } from '@/lib/format';
import { LOCALES, translator, type Locale, type Translate } from '@/lib/i18n';
import { resolveLocale } from '../../params';
import styles from './page.module.css';

/**
 * Шаблон сторінки-відповіді `/{мова}/poland/<slug>`. Текст — файл змісту
 * (`lib/content/`), числа й джерела — з правил (`lib/answer-page.ts`); тут лише
 * розмітка. Сторінки статичні: невідомий slug — 404, а не порожній шаблон.
 */
type SlugParams = Promise<{ locale: string; slug: string }>;

export const dynamicParams = false;

export function generateStaticParams(): { locale: Locale; slug: string }[] {
  return LOCALES.flatMap((locale) => ANSWER_PAGES[locale].map(({ slug }) => ({ locale, slug })));
}

async function load(params: SlugParams): Promise<{ locale: Locale; page: ResolvedAnswerPage }> {
  const locale = await resolveLocale(params);
  const content = answerPage(locale, (await params).slug);
  if (!content) notFound();
  return { locale, page: resolveAnswerPage(locale, content) };
}

export async function generateMetadata({ params }: { params: SlugParams }): Promise<Metadata> {
  const { locale, page } = await load(params);
  const t = translator(locale);
  // openGraph і twitter замінюють об'єкти layout цілком, тож його ключі повторені.
  return {
    title: page.title,
    description: page.description,
    alternates: answerPageAlternates(locale, page.slug),
    openGraph: { type: 'article', locale: t('app.ogLocale'), siteName: t('app.title'), title: page.title, description: page.description },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description },
  };
}

export default async function AnswerPage({ params }: { params: SlugParams }) {
  const { locale, page } = await load(params);
  const t = translator(locale);

  return (
    <main>
      <article className={styles.article}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{t('poland.eyebrow')}</p>
          <h1>{page.title}</h1>
          <p className={styles.lead}>{page.lead}</p>
        </header>

        {page.body.map((block, i) =>
          block.kind === 'h2' ? (
            <h2 key={i}>{block.text}</h2>
          ) : block.kind === 'list' ? (
            <ul key={i} className={styles.list}>
              {block.items!.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{block.text}</p>
          ),
        )}
      </article>

      <section className={`${ruled.inkEdge} ${ruled.sheet} ${styles.cta}`} aria-labelledby="answer-cta">
        <h2 id="answer-cta">{t('answer.cta.title')}</h2>
        <p>{t(page.prefilled ? 'answer.cta.text' : 'answer.cta.textBlank')}</p>
        <Link className={`${button.primary} ${button.arrow}`} href={page.questionnaireHref}>
          {t('app.start')}
        </Link>
      </section>

      <GuideSlot guide={page.guide} />

      <Sources t={t} page={page} />

      <Disclaimer textKey="answer.disclaimer" />
    </main>
  );
}

/**
 * Місце під платний гайд теми 4.1: файл змісту вже називає гайд (`guide`), а
 * слот нічого не показує, доки гайдів немає, — посилання в нікуди гірше за його
 * відсутність. Тема 4.1 дає йому тіло.
 */
function GuideSlot(_props: { guide?: string }) {
  return null;
}

/** Джерела всіх чисел сторінки: назва джерела, а не `rule_id`, і дата звірки. */
function Sources({ t, page }: { t: Translate; page: ResolvedAnswerPage }) {
  if (page.sources.length === 0) return null;
  return (
    <section className={styles.sources} aria-labelledby="answer-sources">
      <h2 id="answer-sources">{t('answer.sources.title')}</h2>
      <ul>
        {page.sources.map((s) => (
          <li key={s.url + s.title}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
            <span className={styles.meta}>
              {t('app.verifiedAt')} {formatDate(s.verifiedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
