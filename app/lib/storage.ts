import type { Draft } from '@/lib/questions/schema';
import { quantizeRevenue } from '@/lib/share';

const KEY = 'tax-navigator:draft';

export interface Restored {
  answers: Draft;
  step: number;
}

interface Stored {
  answers: Draft;
  step: number;
}

const EMPTY: Restored = { answers: {}, step: 0 };

export function saveDraft(draft: Draft, step: number): void {
  if (typeof window === 'undefined') return;
  const safe: Draft = { ...draft };
  // Виручка живе на сітці 2 500 zł, тож її можна зберігати (прогрес переживає F5),
  // не порушуючи «сирі доходи не зберігаємо»: точнішого числа тут ніколи й немає.
  if (safe.monthlyRevenue !== undefined) safe.monthlyRevenue = quantizeRevenue(safe.monthlyRevenue);
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ answers: safe, step } satisfies Stored));
  } catch {
    // Приватний режим або переповнене сховище — прогрес просто не збережеться.
  }
}

export function loadDraft(): Restored {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const answers: Draft = { ...(parsed.answers ?? {}) };
    const step = typeof parsed.step === 'number' && Number.isFinite(parsed.step) ? parsed.step : 0;
    return { answers, step: Math.max(0, Math.trunc(step)) };
  } catch {
    return EMPTY;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Нічого страшного: наступний старт просто почнеться з порожнього стану.
  }
}
