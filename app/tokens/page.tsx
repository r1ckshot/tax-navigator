import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { ColorSwatch } from '@/components/ColorSwatch';
import { RiskBadge } from '@/components/RiskBadge';
import { t } from '@/lib/i18n/uk';
import { parseTokens, type Token } from '@/lib/tokens';
import type { Risk } from '@/lib/calc/types';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: `${t('tokens.title')} · ${t('app.title')}`,
};

/**
 * Словник читається під час збірки, а не з браузера: сторінка статична, і
 * `globals.css` на цей момент лежить поруч. Список токенів не пишеться тут
 * руками — він був би двійником CSS.
 */
export const dynamic = 'force-static';

const RISKS: Risk[] = ['green', 'yellow', 'red'];

/** `--teal-51` → `teal-51`: у підписі ролі префікс лише шумить. */
const bare = (name: string) => name.replace(/^--/, '');

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {hint && <p className={styles.hint}>{hint}</p>}
      {children}
    </section>
  );
}

function ScaleRow({ token, children }: { token: Token; children: React.ReactNode }) {
  return (
    <li className={styles.scaleRow}>
      <code className={styles.scaleName}>
        {token.name}
        <span className={styles.scaleValue}>{token.value}</span>
      </code>
      {children}
    </li>
  );
}

export default function TokensPage() {
  const dict = parseTokens(readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8'));

  return (
    <main>
      <header className={styles.header}>
        <h1>{t('tokens.title')}</h1>
        <p className={styles.lead}>{t('tokens.lead')}</p>
      </header>

      <Section title={t('tokens.palette')} hint={t('tokens.paletteHint')}>
        <div className={styles.grid}>
          {dict.palette.map((token) => (
            <ColorSwatch key={token.name} name={token.name} caption={token.value} />
          ))}
        </div>
      </Section>

      <Section title={t('tokens.roles')} hint={t('tokens.rolesHint')}>
        <div className={styles.grid}>
          {dict.colorRoles.map((role) => (
            <ColorSwatch
              key={role.name}
              name={role.name}
              caption={`${t('tokens.light')} ${bare(role.light)} · ${t('tokens.dark')} ${bare(role.dark)}`}
            />
          ))}
        </div>
      </Section>

      <Section title={t('tokens.type')}>
        <ul className={styles.scale}>
          {dict.text.map((token) => (
            <ScaleRow key={token.name} token={token}>
              <span className={styles.typeSample} style={{ fontSize: `var(${token.name})` }}>
                {t('tokens.typeSample')}
              </span>
            </ScaleRow>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.space')}>
        <ul className={styles.scale}>
          {dict.space.map((token) => (
            <ScaleRow key={token.name} token={token}>
              <span className={styles.spaceBar} style={{ width: `var(${token.name})` }} aria-hidden="true" />
            </ScaleRow>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.radius')}>
        <ul className={styles.scale}>
          {dict.radius.map((token) => (
            <ScaleRow key={token.name} token={token}>
              <span
                className={styles.radiusBox}
                style={{ borderRadius: `var(${token.name})` }}
                aria-hidden="true"
              />
            </ScaleRow>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.components')}>
        <div className={styles.row}>
          {RISKS.map((risk) => (
            <RiskBadge key={risk} risk={risk} />
          ))}
          {RISKS.map((risk) => (
            <RiskBadge key={`${risk}-compact`} risk={risk} compact />
          ))}
        </div>
        <div className={styles.row}>
          <button type="button">{t('tokens.buttonDefault')}</button>
          <button type="button" data-variant="primary">
            {t('tokens.buttonPrimary')}
          </button>
          <button type="button" disabled>
            {t('tokens.buttonDisabled')}
          </button>
        </div>
      </Section>
    </main>
  );
}
