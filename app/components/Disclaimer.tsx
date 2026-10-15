'use client';

import { useT } from './I18nProvider';
import ruled from './Ruled.module.css';
import styles from './Disclaimer.module.css';

/** Дисклеймер присутній на КОЖНОМУ екрані результату. Аркуш із нерухомою
 *  лінійкою: дисклеймер не анімується (DECISIONS 2026-10-12). Сторінка-відповідь
 *  не калькулятор, тож бере свій текст (`answer.disclaimer`). */
export function Disclaimer({ textKey = 'app.disclaimer' }: { textKey?: 'app.disclaimer' | 'answer.disclaimer' }) {
  const t = useT();
  return <p className={`${ruled.inkEdge} ${ruled.sheet} ${styles.disclaimer}`}>{t(textKey)}</p>;
}
