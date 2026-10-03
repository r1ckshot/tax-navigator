import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { translator } from '@/lib/i18n';
import { Showcase } from '../Showcase';
import { sampleResult } from '../sample';
import { Readout } from './Readout';
import styles from './page.module.css';
import './theme.css';

const body = IBM_Plex_Sans({ subsets: ['latin', 'cyrillic'], axes: ['wdth'], variable: '--lab-body', display: 'swap' });
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--lab-mono',
  display: 'swap',
});

const t = translator('uk');

export const metadata: Metadata = { title: `B · ${t('lab.b.name')} · ${t('lab.title')}` };

/** Знак: шкала приладу — коло з рисками, назва моноширинним. */
function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 12l3.5-3.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      nettomap
    </span>
  );
}

export default function DirectionB() {
  const { scenarios } = sampleResult();
  return (
    <Showcase
      direction="b"
      className={`lab-b ${body.variable} ${mono.variable}`}
      styles={styles}
      wordmark={<Wordmark />}
      fonts={['IBM Plex Sans', 'IBM Plex Mono']}
      motion={<Readout scenarios={scenarios} />}
    />
  );
}
