import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Disclaimer } from '@/components/Disclaimer';
import { FreshnessBadge } from '@/components/FreshnessBadge';
import motion from '@/components/Motion.module.css';
import ruled from '@/components/Ruled.module.css';
import { STALE_AFTER_DAYS } from '@/lib/calc/freshness';
import { formatCount } from '@/lib/format';
import { translator, type Translate } from '@/lib/i18n';
import { alternates } from '@/lib/routes';
import { buildSourceCatalog, type GroupId, type SourceEntry } from '@/lib/sources';
import { resolveLocale, type LocaleParams } from '../../params';
import styles from './page.module.css';

const at = (i: number) => ({ '--i': i }) as CSSProperties;

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = translator(locale);
  return {
    alternates: alternates(locale, 'sources'),
  };
}

/**
 * Стан свіжості залежить від дати, а не лише від файла правил: правило старіє
 * без жодного деплою. Раз на добу сторінка перебудовується, тож позначка
 * «давно не звірялось» з'являється вчасно, а не з наступним релізом.
 */
export const revalidate = 86400;

/** Групи сценаріїв беруть назву з тих самих ключів, що таблиця результату. */
const groupTitle = (t: Translate, id: GroupId) =>
  id === 'residency' || id === 'status' || id === 'common' ? t(`sources.group.${id}`) : t(`scenario.${id}`);

const count = (t: Translate, key: string, n: number) => formatCount(n, [t(`${key}.one`), t(`${key}.few`), t(`${key}.many`)]);

function SourceRow({ entry }: { entry: SourceEntry }) {
  return (
    <li className={styles.row}>
      <div className={styles.what}>
        <code className={styles.ruleId}>{entry.ruleId}</code>
        <a href={entry.url} target="_blank" rel="noopener noreferrer">
          {entry.host}
        </a>
      </div>
      <div className={styles.when}>
        <span className={styles.date}>{entry.verifiedAt}</span>
        <FreshnessBadge stale={entry.stale} />
      </div>
    </li>
  );
}

export default async function SourcesPage({ params }: { params: LocaleParams }) {
  const t = translator(await resolveLocale(params));
  const catalog = buildSourceCatalog(new Date());

  return (
    <main>
      <header className={styles.header}>
        <h1 className={motion.soft} style={at(0)}>
          {t('sources.title')}
        </h1>
        <p className={`${motion.soft} ${styles.lead}`} style={at(1)}>
          {t('sources.lead')}
        </p>
        <div className={`${motion.soft} ${styles.summary}`} style={at(2)}>
          <p>
            {count(t, 'sources.rules', catalog.ruleCount)} {count(t, 'sources.groups', catalog.groups.length)}
          </p>
          <p>{t('sources.staleRule').replace('{days}', String(STALE_AFTER_DAYS))}</p>
          {catalog.staleCount > 0 && <p className={styles.staleCount}>{count(t, 'sources.staleCount', catalog.staleCount)}</p>}
        </div>
      </header>

      {catalog.groups.map((group, i) => (
        <section
          key={group.id}
          className={`${ruled.inkRule} ${ruled.sheet} ${styles.group}`}
          style={{ '--ink-rule-delay': `${180 + i * 90}ms` } as CSSProperties}
          aria-labelledby={`group-${group.id}`}
        >
          <header className={styles.groupHeader}>
            <h2 id={`group-${group.id}`} className={motion.soft} style={at(3 + i)}>
              {groupTitle(t, group.id)}
            </h2>
            <span className={`${motion.soft} ${styles.groupCount}`} style={at(3 + i)}>
              {count(t, 'sources.rules', group.entries.length)}
            </span>
          </header>
          <ul className={styles.rows}>
            {group.entries.map((entry) => (
              <SourceRow key={entry.ruleId} entry={entry} />
            ))}
          </ul>
        </section>
      ))}

      <Disclaimer />
    </main>
  );
}
