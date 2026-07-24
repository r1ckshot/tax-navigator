import type { Answers } from '@/lib/calc/types';

export type Draft = Partial<Answers>;

export interface FieldOption {
  value: string | number | boolean;
  labelKey: string;
}

export interface Field {
  name: keyof Answers;
  kind: 'choice' | 'number';
  labelKey: string;
  hintKey?: string;
  options?: FieldOption[];
  showIf?: (a: Draft) => boolean;
}

export interface Screen {
  id: string;
  titleKey: string;
  fields: Field[];
  /** Екран показується, лише коли відповідь реально змінює результат. */
  showIf?: (a: Draft) => boolean;
}

const yesNo = (prefix: string): FieldOption[] => [
  { value: true, labelKey: `${prefix}.yes` },
  { value: false, labelKey: `${prefix}.no` },
];

/**
 * Екран ≠ поле: споріднені осі живуть на одному кроці, тож користувач бачить
 * ~10 кроків, а двигун отримує всі потрібні поля.
 */
export const SCREENS: Screen[] = [
  {
    id: 'days',
    titleKey: 'q.days.title',
    fields: [
      {
        name: 'daysInPl',
        kind: 'choice',
        labelKey: 'q.days.label',
        hintKey: 'q.days.hint',
        options: [
          { value: 'lt183', labelKey: 'q.days.lt183' },
          { value: 'gte183', labelKey: 'q.days.gte183' },
          { value: 'unsure', labelKey: 'q.days.unsure' },
        ],
      },
    ],
  },
  {
    id: 'daysApprox',
    titleKey: 'q.daysApprox.title',
    showIf: (a) => a.daysInPl === 'unsure',
    fields: [{ name: 'daysInPlApprox', kind: 'number', labelKey: 'q.daysApprox.label' }],
  },
  {
    id: 'centers',
    titleKey: 'q.centers.title',
    fields: [
      {
        name: 'personalCenter',
        kind: 'choice',
        labelKey: 'q.centers.personal',
        hintKey: 'q.centers.personalHint',
        options: placeOptions('q.centers'),
      },
      {
        name: 'economicCenter',
        kind: 'choice',
        labelKey: 'q.centers.economic',
        hintKey: 'q.centers.economicHint',
        options: placeOptions('q.centers'),
      },
    ],
  },
  {
    id: 'special52zr',
    titleKey: 'q.special.title',
    fields: [
      {
        name: 'specialLaw52zr',
        kind: 'choice',
        labelKey: 'q.special.label',
        hintKey: 'q.special.hint',
        options: [
          { value: 'yes', labelKey: 'q.special.yes' },
          { value: 'no', labelKey: 'q.special.no' },
          { value: 'unknown', labelKey: 'q.special.unknown' },
        ],
      },
    ],
  },
  {
    id: 'income',
    titleKey: 'q.income.title',
    fields: [
      {
        name: 'incomeSource',
        kind: 'choice',
        labelKey: 'q.income.source',
        options: [
          { value: 'plClients', labelKey: 'q.income.plClients' },
          { value: 'foreignClients', labelKey: 'q.income.foreignClients' },
          { value: 'uaSalary', labelKey: 'q.income.uaSalary' },
          { value: 'none', labelKey: 'q.income.none' },
        ],
      },
      {
        name: 'permanentHomeInUa',
        kind: 'choice',
        labelKey: 'q.income.permanentHomeInUa',
        hintKey: 'q.income.permanentHomeInUaHint',
        options: yesNo('q.income.home'),
      },
    ],
  },
  {
    id: 'uaFop',
    titleKey: 'q.uaFop.title',
    fields: [
      { name: 'hasActiveUaFop', kind: 'choice', labelKey: 'q.uaFop.label', options: yesNo('q.uaFop') },
    ],
  },
  {
    id: 'revenue',
    titleKey: 'q.revenue.title',
    fields: [
      { name: 'monthlyRevenue', kind: 'number', labelKey: 'q.revenue.label', hintKey: 'q.revenue.hint' },
    ],
  },
  {
    id: 'work',
    titleKey: 'q.work.title',
    fields: [
      {
        name: 'workKind',
        kind: 'choice',
        labelKey: 'q.work.kind',
        hintKey: 'q.work.kindHint',
        options: [
          { value: 'programming', labelKey: 'q.work.programming' },
          { value: 'otherIt', labelKey: 'q.work.otherIt' },
          { value: 'nonIt', labelKey: 'q.work.nonIt' },
        ],
      },
      {
        name: 'expenseShare',
        kind: 'choice',
        labelKey: 'q.work.expenses',
        options: [
          { value: 'lt10', labelKey: 'q.work.lt10' },
          { value: 'from10to30', labelKey: 'q.work.from10to30' },
          { value: 'gt30', labelKey: 'q.work.gt30' },
        ],
      },
    ],
  },
  {
    id: 'parallelUop',
    titleKey: 'q.parallelUop.title',
    fields: [
      {
        name: 'hasParallelUop',
        kind: 'choice',
        labelKey: 'q.parallelUop.label',
        hintKey: 'q.parallelUop.hint',
        options: yesNo('q.parallelUop'),
      },
    ],
  },
  {
    id: 'formerEmployer',
    titleKey: 'q.formerEmployer.title',
    fields: [
      {
        name: 'formerEmployer',
        kind: 'choice',
        labelKey: 'q.formerEmployer.label',
        hintKey: 'q.formerEmployer.hint',
        options: [
          { value: 'no', labelKey: 'q.formerEmployer.no' },
          { value: 'identical', labelKey: 'q.formerEmployer.identical' },
          { value: 'partial', labelKey: 'q.formerEmployer.partial' },
        ],
      },
    ],
  },
  {
    id: 'jdg',
    titleKey: 'q.jdg.title',
    fields: [
      {
        name: 'jdgStatus',
        kind: 'choice',
        labelKey: 'q.jdg.status',
        options: [
          { value: 'none', labelKey: 'q.jdg.none' },
          { value: 'lt6', labelKey: 'q.jdg.lt6' },
          { value: 'from6to30', labelKey: 'q.jdg.from6to30' },
          { value: 'gt30', labelKey: 'q.jdg.gt30' },
        ],
      },
      {
        name: 'voluntarySickness',
        kind: 'choice',
        labelKey: 'q.jdg.sickness',
        // Хворобова змінює лише суму preferencyjnego.
        showIf: (a) => a.jdgStatus === 'from6to30' && !a.hasParallelUop && a.formerEmployer === 'no',
        options: yesNo('q.jdg.sickness'),
      },
    ],
  },
  {
    id: 'jdgHistory',
    titleKey: 'q.jdgHistory.title',
    // Питаємо лише коли пільга ще досяжна: при zbieg або втраченій пільзі
    // відповідь нічого не змінює.
    showIf: (a) =>
      !a.hasParallelUop && a.formerEmployer === 'no' && a.jdgStatus !== undefined && a.jdgStatus !== 'gt30',
    fields: [
      {
        name: 'hadJdgInLast60Months',
        kind: 'choice',
        labelKey: 'q.jdgHistory.label',
        hintKey: 'q.jdgHistory.hint',
        options: yesNo('q.jdgHistory'),
      },
    ],
  },
];

function placeOptions(prefix: string): FieldOption[] {
  return [
    { value: 'PL', labelKey: `${prefix}.pl` },
    { value: 'UA', labelKey: `${prefix}.ua` },
    { value: 'split', labelKey: `${prefix}.split` },
  ];
}

export function visibleScreens(answers: Draft): Screen[] {
  return SCREENS.filter((s) => !s.showIf || s.showIf(answers));
}

export function visibleFields(screen: Screen, answers: Draft): Field[] {
  return screen.fields.filter((f) => !f.showIf || f.showIf(answers));
}

export function isScreenComplete(screen: Screen, answers: Draft): boolean {
  return visibleFields(screen, answers).every((f) => answers[f.name] !== undefined);
}

/**
 * Куди повертати користувача після F5. Збережений крок — це стеля, а не істина:
 * виручка навмисне не переживає перезавантаження (див. storage.ts), тож сліпе
 * відновлення кроку висадило б людину ПІСЛЯ порожнього поля, і вона дійшла б до
 * результату з діркою у відповідях. Тому беремо перший незаповнений екран, якщо
 * він раніше за збережений крок.
 */
export function resumeIndex(answers: Draft, savedStep: number): number {
  const screens = visibleScreens(answers);
  const firstIncomplete = screens.findIndex((s) => !isScreenComplete(s, answers));
  const ceiling = firstIncomplete === -1 ? screens.length - 1 : firstIncomplete;
  return Math.max(0, Math.min(savedStep, ceiling));
}

/** Виручка: тільки додатне число; поза межами — крок не пускає далі. */
export const REVENUE_LIMITS = { min: 1, max: 8517200 / 12 } as const;

export function validateRevenue(value: unknown): 'ok' | 'notANumber' | 'tooLow' | 'overRyczaltLimit' {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'notANumber';
  if (value < REVENUE_LIMITS.min) return 'tooLow';
  if (value > REVENUE_LIMITS.max) return 'overRyczaltLimit';
  return 'ok';
}
