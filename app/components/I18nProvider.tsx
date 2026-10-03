'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, translator, type Locale, type Translate } from '@/lib/i18n';

interface I18n {
  locale: Locale;
  t: Translate;
}

/**
 * Без провайдера — мова за замовчуванням: компонент, відрендерений поза
 * маршрутом (тест, `/tokens`), показує той самий `uk`, що й раніше.
 */
const I18nContext = createContext<I18n>({ locale: DEFAULT_LOCALE, t: translator(DEFAULT_LOCALE) });

/** Мову задає `[locale]/layout.tsx` з адреси; компоненти беруть її лише звідси (ADR-0003). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: translator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
