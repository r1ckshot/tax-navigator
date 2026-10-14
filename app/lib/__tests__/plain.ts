import { t as ukT } from '../i18n/uk';

/**
 * Текст без типографіки (`i18n/typeset.ts`): нерозривний пробіл → звичайний.
 * Для перевірок змісту рядка, а не того, де йому не можна ламатись.
 */
export const plain = (text: string): string => text.replace(/\u00A0/g, ' ');

/** Рядок рівно таким, як він стоїть у DOM: для назв ролей і `textContent`. */
export const t = ukT;

/**
 * Рядок для `getByText` / `getByLabelText`. Testing Library зводить пробіли
 * в тексті вузла (нерозривний теж) до звичайного, а рядок запиту — ні; без
 * цього запит з типографікою не знайшов би власного тексту.
 */
export const q = (key: string, vars?: Record<string, string>): string => plain(ukT(key, vars));
