import type { Answers } from '@/lib/calc/types';
import type { Draft } from '@/lib/questions/schema';

const KEY = 'tax-navigator:draft';

/**
 * Прогрес переживає F5, але точна виручка — ні. Правило «сирі доходи не
 * зберігаємо» діє і для sessionStorage, тому поле навмисне випадає при
 * відновленні, і користувач вводить його знову.
 */
const NEVER_PERSIST: (keyof Answers)[] = ['monthlyRevenue'];

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
  for (const key of NEVER_PERSIST) delete safe[key];
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
    for (const key of NEVER_PERSIST) delete answers[key];
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
