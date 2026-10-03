import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { translator } from '@/lib/i18n';
import { Showcase } from '../Showcase';
import { sampleResult } from '../sample';
import { Ledger } from './Ledger';
import styles from './page.module.css';
import './theme.css';

const display = Source_Serif_4({ subsets: ['latin', 'cyrillic'], axes: ['opsz'], variable: '--lab-display', display: 'swap' });
const body = Inter({ subsets: ['latin', 'cyrillic'], variable: '--lab-body', display: 'swap' });

const t = translator('uk');

export const metadata: Metadata = { title: `A · ${t('lab.a.name')} · ${t('lab.title')}` };

/** Знак: «netto» прямим, «map» курсивом — редакційна пара в одному слові. */
function Wordmark() {
  return (
    <span className={styles.wordmark}>
      netto<em>map</em>
    </span>
  );
}

export default function DirectionA() {
  const { scenarios } = sampleResult();
  return (
    <Showcase
      direction="a"
      className={`lab-a ${display.variable} ${body.variable}`}
      styles={styles}
      wordmark={<Wordmark />}
      fonts={['Source Serif 4', 'Inter']}
      motion={<Ledger scenarios={scenarios} />}
    />
  );
}
