import { uk } from './uk';
import { createT, type Dictionary, type Translate } from './translate';

export type { Dictionary, Translate } from './translate';

/**
 * Увімкнені мови. Ключ — сегмент адреси (`/uk/poland`), значення — словник.
 * Нова мова вмикається одним рядком тут: маршрути, `<html lang>`, hreflang і
 * метадані беруть список звідси (ADR-0003). Тест `i18n-locales` не дає
 * увімкнути мову, якій бракує хоч одного ключа `uk`.
 */
export const DICTIONARIES = { uk } satisfies Record<string, Dictionary>;

export type Locale = keyof typeof DICTIONARIES;

export const LOCALES = Object.keys(DICTIONARIES) as Locale[];

/** Мова `x-default` і сторінок, які мови не мають (`/tokens`, 404). */
export const DEFAULT_LOCALE: Locale = 'uk';

export function isLocale(value: string): value is Locale {
  return Object.hasOwn(DICTIONARIES, value);
}

export function translator(locale: Locale): Translate {
  return createT(DICTIONARIES[locale]);
}
