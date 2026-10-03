import Link from 'next/link';
import type { ReactNode } from 'react';
import { ComparisonTable } from '@/components/ComparisonTable';
import { Disclaimer } from '@/components/Disclaimer';
import { ResidencyVerdict } from '@/components/ResidencyVerdict';
import type { ScenarioId } from '@/lib/calc/types';
import { translator } from '@/lib/i18n';
import { countryHref } from '@/lib/routes';
import { sampleResult } from './sample';
import { SchemeSwitch, type Scheme } from './SchemeSwitch';
import { Replay } from './Replay';
import lab from './Showcase.module.css';

export type Direction = 'a' | 'b' | 'c';

/** Ті самі шість варіантів у тому ж порядку, що й на лендінгу та в результаті. */
const SCENARIOS: ScenarioId[] = ['fop', 'jdg', 'incubator', 'nierejestrowana', 'zlecenie', 'uop'];

/** Ролі, які видно в специфікації напряму: фони, чорнило, акцент. */
const ROLES = ['--plane', '--surface', '--sunken', '--ink', '--ink-secondary', '--ink-muted', '--accent', '--accent-soft'];

const t = translator('uk');

/**
 * Один і той самий зміст для трьох напрямів — як «CSS Zen Garden»: розмітка
 * спільна, вигляд дає CSS-модуль напряму (`styles`) і його `theme.css`. Тож
 * Mike порівнює саме стиль, а не різний текст чи різний набір блоків.
 *
 * Класи з `styles`, яких напрям не описав, просто нічого не роблять.
 */
export function Showcase({
  direction,
  className,
  styles: s,
  wordmark,
  fonts,
  motion,
  initialScheme = 'system',
}: {
  direction: Direction;
  className: string;
  styles: Record<string, string>;
  wordmark: ReactNode;
  fonts: string[];
  motion: ReactNode;
  initialScheme?: Scheme;
}) {
  const { residency, scenarios } = sampleResult();

  return (
    <div data-lab={direction} data-scheme={initialScheme} className={`${className} ${s.root ?? ''}`}>
      <header className={s.bar}>
        <span className={s.brand}>{wordmark}</span>
        <nav className={s.nav}>
          <Link href={countryHref('uk', 'sources')}>{t('app.sources')}</Link>
          <Link href="/design-lab">{t('lab.back')}</Link>
        </nav>
      </header>

      <main className={s.main}>
        <section className={s.hero} aria-labelledby="lab-hero">
          <p className={s.eyebrow}>{t('lab.eyebrow')}</p>
          <h1 id="lab-hero" className={s.headline}>
            {t('app.lead')}
          </h1>
          <p className={s.intro}>{t('app.intro')}</p>
          <ul className={s.scenarios}>
            {SCENARIOS.map((id) => (
              <li key={id}>{t(`scenario.${id}`)}</li>
            ))}
          </ul>
          <div className={s.actions}>
            <Link className={s.cta} href={countryHref('uk', 'questionnaire')}>
              {t('app.start')}
            </Link>
            <Link className={s.secondary} href={countryHref('uk', 'sources')}>
              {t('sources.link')}
            </Link>
          </div>
          <p className={s.trust}>{t('app.trust')}</p>
        </section>

        <section className={s.section} aria-labelledby="lab-result">
          <h2 id="lab-result" className={s.sectionTitle}>
            {t('lab.result')}
          </h2>
          <p className={s.sectionNote}>{t('lab.resultNote')}</p>
          <div className={s.result}>
            <ResidencyVerdict result={residency} />
            <ComparisonTable scenarios={scenarios} />
            <Disclaimer />
          </div>
        </section>

        <section className={s.section} aria-labelledby="lab-motion">
          <h2 id="lab-motion" className={s.sectionTitle}>
            {t('lab.motion')}
          </h2>
          <p className={s.sectionNote}>
            {t(`lab.${direction}.motion`)} {t('lab.motionReduced')}
          </p>
          <div className={s.motion}>
            <Replay className={lab.replay}>{motion}</Replay>
          </div>
        </section>

        <section className={s.section} aria-labelledby="lab-spec">
          <h2 id="lab-spec" className={s.sectionTitle}>
            {t('lab.spec')}
          </h2>
          <dl className={lab.spec}>
            <dt>{t('lab.fonts')}</dt>
            <dd>{fonts.join(' + ')}</dd>
            <dt>{t('lab.roles')}</dt>
            <dd>
              <ul className={lab.chips}>
                {ROLES.map((role) => (
                  <li key={role}>
                    <span className={lab.chip} style={{ background: `var(${role})` }} aria-hidden="true" />
                    <code>{role.slice(2)}</code>
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
        </section>
      </main>

      <SchemeSwitch initial={initialScheme} />
    </div>
  );
}
