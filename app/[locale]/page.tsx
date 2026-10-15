import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import button from '@/components/Button.module.css';
import motion from '@/components/Motion.module.css';
import ruled from '@/components/Ruled.module.css';
import { withWordmark } from '@/components/Wordmark';
import { translator } from '@/lib/i18n';
import { brandHref, countryHref } from '@/lib/routes';
import { waitlistHref } from '@/lib/waitlist';
import { resolveLocale, type LocaleParams } from './params';
import styles from './page.module.css';

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = translator(locale);
  // Вкладка головної — лише назва бренду (Mike); прев'ю лінка пояснює, що це.
  // Решта сторінок має власні заголовки: за ними пошук ранжує сторінку.
  const title = t('brand.title');
  // Переноси рядків — для верстки сторінки; у метаописі й прев'ю вони зайві.
  const description = t('brand.lead').replace(/\n/g, ' ');
  // openGraph і twitter замінюють об'єкти з layout цілком, тож ключі layout
  // (locale, siteName, картка) повторені тут, щоб не загубитись.
  return {
    title: t('app.title'),
    description,
    alternates: { canonical: brandHref(locale) },
    openGraph: { type: 'website', locale: t('app.ogLocale'), siteName: t('app.title'), title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Лендінг бренду `/`: два входи. Країна, де людина вже живе, — робочий;
 * порівняння країн — «скоро» з листом очікування (та сама форма, що в
 * результаті; дані анкети туди не йдуть — `waitlistHref` відкидає query).
 * Обидва входи — картки-посилання з однаковим hover; кнопка всередині лише
 * виглядає кнопкою (`Button.module.css`, `.group`).
 *
 * Поява: ліва колонка (заголовок → текст), потім входи праворуч.
 */
export default async function BrandHome({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const t = translator(locale);
  const waitlist = waitlistHref();
  const at = (i: number) => ({ '--i': i }) as CSSProperties;

  // Другий вхід: без форми очікування він не веде нікуди, тож лишається блоком.
  const compareBody = (
    <>
      <h2 className={styles.entryTitle}>{t('brand.compare.title')}</h2>
      <p className={styles.entryBody}>{t('brand.compare.body')}</p>
      {/* «Скоро» — словами в запрошенні, а не бейджем; без форми — одним словом. */}
      <p className={styles.entryBody}>{waitlist ? t('brand.compare.invite') : t('cta.soon')}</p>
      {waitlist && <span className={`${button.secondary} ${styles.action}`}>{t('cta.action')}</span>}
    </>
  );

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="brand-hero">
        <h1 id="brand-hero" className={`${motion.reveal} ${styles.headline}`} style={at(0)}>
          {t('brand.headline')}
        </h1>
        <p className={`${motion.reveal} ${styles.lead}`} style={at(1)}>
          {withWordmark(t('brand.lead'))}
        </p>
      </section>

      <ul className={`${ruled.list} ${ruled.inkRule} ${styles.entries}`}>
        <li style={at(0)}>
          <Link className={`${button.group} ${styles.entry}`} href={countryHref(locale)}>
            <h2 className={styles.entryTitle}>{t('brand.live.title')}</h2>
            <p className={styles.entryBody}>{t('brand.live.body')}</p>
            <span className={`${button.primary} ${button.arrow} ${styles.action}`}>{t('brand.live.action')}</span>
          </Link>
        </li>
        <li style={at(1)}>
          {waitlist ? (
            <a
              className={`${button.group} ${styles.entry}`}
              href={waitlist}
              target="_blank"
              rel="noopener noreferrer"
            >
              {compareBody}
            </a>
          ) : (
            <div className={styles.entry}>{compareBody}</div>
          )}
        </li>
      </ul>
    </main>
  );
}
