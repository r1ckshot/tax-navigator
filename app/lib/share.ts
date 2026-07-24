import type { Answers } from '@/lib/calc/types';

/**
 * Шеринг результату. Правило product-safety «сирі доходи не зберігаємо» діє і тут:
 * точна виручка НІКОЛИ не потрапляє в URL — лише смуга, з якої відтворюється
 * репрезентативне значення. Лінк дає той самий вердикт і ті самі порядки цифр,
 * але не розкриває, скільки людина заробляє.
 */
export const REVENUE_BANDS = [
  { id: 'a', max: 5000, representative: 4000 },
  { id: 'b', max: 10000, representative: 7500 },
  { id: 'c', max: 15000, representative: 12500 },
  { id: 'd', max: 25000, representative: 20000 },
  { id: 'e', max: Infinity, representative: 32000 },
] as const;

export function bandOf(monthlyRevenue: number): string {
  return (REVENUE_BANDS.find((b) => monthlyRevenue <= b.max) ?? REVENUE_BANDS[REVENUE_BANDS.length - 1]).id;
}

export function revenueFromBand(bandId: string): number {
  return (REVENUE_BANDS.find((b) => b.id === bandId) ?? REVENUE_BANDS[2]).representative;
}

const KEYS: Record<string, keyof Answers> = {
  d: 'daysInPl',
  p: 'personalCenter',
  e: 'economicCenter',
  s: 'specialLaw52zr',
  i: 'incomeSource',
  h: 'permanentHomeInUa',
  f: 'hasActiveUaFop',
  w: 'workKind',
  x: 'expenseShare',
  u: 'hasParallelUop',
  m: 'formerEmployer',
  j: 'jdgStatus',
  o: 'hadJdgInLast60Months',
  k: 'voluntarySickness',
};

export function encodeAnswers(answers: Answers): string {
  const params = new URLSearchParams();
  for (const [short, key] of Object.entries(KEYS)) {
    const value = answers[key];
    if (value === undefined) continue;
    params.set(short, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  // Замість monthlyRevenue — лише смуга.
  params.set('r', bandOf(answers.monthlyRevenue));
  return params.toString();
}

export function decodeAnswers(query: string): Partial<Answers> {
  const params = new URLSearchParams(query);
  const out: Record<string, unknown> = {};

  for (const [short, key] of Object.entries(KEYS)) {
    const raw = params.get(short);
    if (raw === null) continue;
    out[key] = BOOLEAN_KEYS.has(key) ? raw === '1' : raw;
  }

  const band = params.get('r');
  if (band) out.monthlyRevenue = revenueFromBand(band);

  return out as Partial<Answers>;
}

const BOOLEAN_KEYS = new Set<keyof Answers>([
  'permanentHomeInUa',
  'hasActiveUaFop',
  'hasParallelUop',
  'hadJdgInLast60Months',
  'voluntarySickness',
]);
