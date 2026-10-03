'use client';

import { useState, type ReactNode } from 'react';
import { useT } from '@/components/I18nProvider';

/**
 * Повтор анімації: новий `key` перемонтовує дітей, і CSS-анімація стартує
 * заново. Стан анімації живе лише в CSS — тут жодних таймерів.
 */
export function Replay({ children, className }: { children: ReactNode; className?: string }) {
  const t = useT();
  const [run, setRun] = useState(0);
  return (
    <>
      <div key={run}>{children}</div>
      <button type="button" className={className} onClick={() => setRun((n) => n + 1)}>
        {t('lab.replay')}
      </button>
    </>
  );
}
