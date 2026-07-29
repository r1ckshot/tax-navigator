import type { Answers } from '@/lib/calc/types';
import { quantizeRevenue } from '@/lib/calc/quantize';

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
  // Замість точної суми — квантизоване до 2 500 значення (те саме, що бачить слайдер).
  params.set('r', String(quantizeRevenue(answers.monthlyRevenue)));
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

  const r = params.get('r');
  if (r !== null && r !== '') out.monthlyRevenue = quantizeRevenue(Number(r));

  return out as Partial<Answers>;
}

const BOOLEAN_KEYS = new Set<keyof Answers>([
  'permanentHomeInUa',
  'hasActiveUaFop',
  'hasParallelUop',
  'hadJdgInLast60Months',
  'voluntarySickness',
]);
