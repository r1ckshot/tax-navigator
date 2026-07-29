import type { Answers } from '@/lib/calc/types';
import { homeInUaMatters } from '@/lib/calc/residency';
import { REVENUE_MAX, REVENUE_MIN, REVENUE_STEP } from '@/lib/calc/quantize';

export type Draft = Partial<Answers>;

export interface FieldOption {
  value: string | number | boolean;
  labelKey: string;
}

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  default: number;
  unitKey: string;
  /** Показувати «+» на максимумі (значення «і більше»). */
  openEnded?: boolean;
}

export interface Field {
  name: keyof Answers;
  kind: 'choice' | 'slider';
  labelKey: string;
  options?: FieldOption[];
  slider?: SliderConfig;
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
    fields: [
      {
        name: 'daysInPlApprox',
        kind: 'slider',
        labelKey: 'q.daysApprox.label',
        slider: { min: 0, max: 366, step: 1, default: 183, unitKey: 'q.daysApprox.unit' },
      },
    ],
  },
  {
    id: 'centers',
    titleKey: 'q.centers.title',
    fields: [
      {
        name: 'personalCenter',
        kind: 'choice',
        labelKey: 'q.centers.personal',
        options: placeOptions('q.centers'),
      },
      {
        name: 'economicCenter',
        kind: 'choice',
        labelKey: 'q.centers.economic',
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
    ],
  },
  {
    id: 'homeInUa',
    titleKey: 'q.home.title',
    // Житло в UA — перший тай-брейкер Конвенції. Питаємо лише коли резидентство
    // неоднозначне, тобто коли ця відповідь реально розвертає вердикт.
    showIf: (a) => homeInUaMatters(a),
    fields: [
      {
        name: 'permanentHomeInUa',
        kind: 'choice',
        labelKey: 'q.income.permanentHomeInUa',
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
      {
        name: 'monthlyRevenue',
        kind: 'slider',
        labelKey: 'q.revenue.label',
        slider: {
          min: REVENUE_MIN,
          max: REVENUE_MAX,
          step: REVENUE_STEP,
          default: 15000,
          unitKey: 'q.revenue.unit',
          openEnded: true,
        },
      },
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
