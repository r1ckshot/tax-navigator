import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { translator } from '@/lib/i18n';
import { Showcase } from '../Showcase';
import { RouteMap } from './RouteMap';
import styles from './page.module.css';
import './theme.css';

const display = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--lab-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--lab-mono', display: 'swap' });

const t = translator('uk');

export const metadata: Metadata = { title: `C · ${t('lab.c.name')} · ${t('lab.title')}` };

/** Знак: дві точки й дуга між ними — маршрут, з якого й назва «map». */
function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true">
        <path d="M4 15 C 8 3, 20 3, 24 9" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="4" cy="15" r="3" fill="currentColor" />
        <circle cx="24" cy="9" r="3" fill="var(--accent)" />
      </svg>
      nettomap
    </span>
  );
}

export default function DirectionC() {
  return (
    <Showcase
      direction="c"
      className={`lab-c ${display.variable} ${mono.variable}`}
      styles={styles}
      wordmark={<Wordmark />}
      fonts={['Manrope', 'JetBrains Mono']}
      motion={<RouteMap />}
      initialScheme="dark"
    />
  );
}
