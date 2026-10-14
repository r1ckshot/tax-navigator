import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { translator } from '@/lib/i18n';
import type { ScenarioId } from '@/lib/calc/types';
import { alternates, countryHref } from '@/lib/routes';
import button from '@/components/Button.module.css';
import motion from '@/components/Motion.module.css';
import ruled from '@/components/Ruled.module.css';
import { resolveLocale, type LocaleParams } from '../params';
import styles from './page.module.css';

/** Ті самі шість сценаріїв і в тому ж порядку, що й у таблиці результату. */
const SCENARIOS: ScenarioId[] = ['fop', 'jdg', 'incubator', 'nierejestrowana', 'zlecenie', 'uop'];

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  return { alternates: alternates(await resolveLocale(params)) };
}

/**
 * Лендінг країни, напрям «Реєстр»: шпальта, а не картка по центру. Порядок у
 * розмітці — порядок на телефоні (заголовок → пояснення → кнопка → що
 * порівнюємо), тож кнопка лишається на першому екрані. На ПК — дві колонки на
 * один екран: теза й дія ліворуч, реєстр шести варіантів праворуч.
 *
 * Поява: ліва колонка по черзі (надрядок → заголовок → текст → кнопка →
 * джерела), потім реєстр праворуч рядок за рядком.
 */
export default async function Home({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const t = translator(locale);
  const at = (i: number) => ({ '--i': i }) as CSSProperties;

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="poland-hero">
        <p className={`${motion.reveal} ${styles.eyebrow}`} style={at(0)}>
          {t('poland.eyebrow')}
        </p>
        <h1 id="poland-hero" className={`${motion.reveal} ${styles.headline}`} style={at(1)}>
          {t('app.lead')}
        </h1>
        <div className={styles.side}>
          <p className={`${motion.reveal} ${styles.intro}`} style={at(2)}>
            {t('app.intro')}
          </p>
          <div className={`${motion.reveal} ${styles.actions}`} style={at(3)}>
            <Link className={`${button.primary} ${button.arrow}`} href={countryHref(locale, 'questionnaire')}>
              {t('app.start')}
            </Link>
          </div>
          <p className={`${motion.reveal} ${styles.trust}`} style={at(4)}>
            {t('app.trust')}
          </p>
        </div>
      </section>

      <section className={styles.compared} aria-labelledby="poland-compared">
        <h2 id="poland-compared" className={`${motion.reveal} ${ruled.inkRule} ${styles.label}`} style={at(4)}>
          {t('poland.compared')}
        </h2>
        <ul className={`${ruled.list} ${styles.scenarios}`}>
          {SCENARIOS.map((id, i) => (
            <li key={id} style={at(i)}>
              {t(`scenario.${id}`)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
