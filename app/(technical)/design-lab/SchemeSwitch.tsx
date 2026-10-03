'use client';

import { useRef, useState } from 'react';
import { useT } from '@/components/I18nProvider';
import styles from './SchemeSwitch.module.css';

export type Scheme = 'system' | 'light' | 'dark';

const SCHEMES: Scheme[] = ['system', 'light', 'dark'];

/**
 * Перемикач теми лише для лабораторії: щоб порівняти напрями у світлій і темній
 * темі, не перемикаючи систему телефона. Пише `data-scheme` на обгортку напряму
 * (`[data-lab]`), а `lab.css` перетворює його на `color-scheme`.
 */
export function SchemeSwitch({ initial }: { initial: Scheme }) {
  const t = useT();
  const [scheme, setScheme] = useState<Scheme>(initial);
  const ref = useRef<HTMLDivElement>(null);

  function choose(next: Scheme) {
    setScheme(next);
    ref.current?.closest<HTMLElement>('[data-lab]')?.setAttribute('data-scheme', next);
  }

  return (
    <div ref={ref} className={styles.switch} role="group" aria-label={t('lab.scheme')}>
      {SCHEMES.map((s) => (
        <button key={s} type="button" aria-pressed={scheme === s} onClick={() => choose(s)}>
          {t(`lab.scheme.${s}`)}
        </button>
      ))}
    </div>
  );
}
