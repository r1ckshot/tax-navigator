import type { Source } from '@/lib/rules/types';

// --- Відповіді анкети (10 екранів, ~14 полів) ---

export type Place = 'PL' | 'UA' | 'split';
export type DaysInPl = 'lt183' | 'gte183' | 'unsure';
export type SpecialLaw = 'yes' | 'no' | 'unknown';
export type IncomeSource = 'plClients' | 'foreignClients' | 'uaSalary' | 'none';
export type WorkKind = 'programming' | 'otherIt' | 'nonIt';
export type ExpenseShare = 'lt10' | 'from10to30' | 'gt30';
/**
 * Межі відповідають реальним етапам, а не круглим числам: ulga na start триває
 * 6 міс, далі preferencyjny 24 міс — тобто пільговий період закінчується на 30-му,
 * а не на 24-му місяці.
 */
export type JdgStatus = 'none' | 'lt6' | 'from6to30' | 'gt30';
/** Прапорець *były pracodawca*: два різні тести, тому три стани, а не так/ні. */
export type FormerEmployer = 'no' | 'identical' | 'partial';

export interface Answers {
  daysInPl: DaysInPl;
  /** Умовне: показується лише коли daysInPl === 'unsure'. */
  daysInPlApprox?: number;
  personalCenter: Place;
  economicCenter: Place;
  specialLaw52zr: SpecialLaw;
  incomeSource: IncomeSource;
  permanentHomeInUa: boolean;
  hasActiveUaFop: boolean;
  /** Нетто без VAT. Живе лише в памʼяті — не зберігається і не йде в URL. */
  monthlyRevenue: number;
  workKind: WorkKind;
  expenseShare: ExpenseShare;
  hasParallelUop: boolean;
  formerEmployer: FormerEmployer;
  jdgStatus: JdgStatus;
  /** Умовне: лише коли jdgStatus === 'none' | 'lt6' | 'from6to24'. */
  hadJdgInLast60Months?: boolean;
  voluntarySickness: boolean;
}

// --- Результати ---

export type Risk = 'green' | 'yellow' | 'red';

export interface Range {
  min: number;
  max: number;
}

export type ScenarioId = 'fop' | 'jdg' | 'incubator' | 'uop';
export type SubformId = 'ryczalt' | 'liniowy' | 'skala' | 'kup20' | 'kup50';

export interface SubformResult {
  id: SubformId;
  /** null = свідомо без числа. */
  rangeMonthly: Range | null;
  available: boolean;
  unavailableReasonKey?: string;
  sources: Source[];
}

export interface ScenarioResult {
  id: ScenarioId;
  /** null = свідомо без числа (напр. ФОП: ЄСВ/ВЗ не звірені). */
  rangeMonthly: Range | null;
  risk: Risk;
  riskReasonKey: string;
  noteKeys: string[];
  subforms?: SubformResult[];
  sources: Source[];
}

export type TiebreakStep = 'permanentHome' | 'centerOfInterests' | 'habitualAbode' | 'citizenship';
export type ResidencyBasis = 'days' | 'centerPersonal' | 'centerEconomic' | 'declaration52zr';

export interface ResidencyResult {
  /** Резидент PL за польськими правилами (art. 3 ustawy o PIT). */
  plResident: boolean;
  /** Чому саме — може бути кілька підстав одночасно. */
  basis: ResidencyBasis[];
  /** Є ознаки звʼязку і з UA — тоді розкручуємо тай-брейки Конвенції. */
  dualRisk: boolean;
  tiebreak?: {
    resolvedAt: TiebreakStep;
    result: 'PL' | 'UA' | 'unresolved';
  };
  /** art. 52zr діє до 31.12.2026; з 2027 — загальні правила. */
  sunsetNote: boolean;
  sources: Source[];
}
