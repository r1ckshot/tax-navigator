'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/next';
import { scrubEvent } from '@/lib/analytics';

/**
 * Vercel Web Analytics без cookie: перегляди сторінок, звідки прийшли, країна,
 * пристрій. Перед відправкою з адреси знімається query і `#` (`lib/analytics.ts`) —
 * відповіді анкети туди не доходять. Власних подій (кліки, кроки анкети) немає
 * свідомо (DECISIONS 2026-10-15). Обгортка клієнтська, бо `beforeSend` — функція,
 * а серверний layout функцій у клієнтський компонент не передає.
 */
export function Analytics() {
  return <VercelAnalytics beforeSend={scrubEvent} />;
}
