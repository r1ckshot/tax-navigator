// store.ts: доступ до rules-as-data і рахунок свіжості.
// Жодного import з MCP SDK — цей шар тестується без транспорту і протоколу
// (та сама межа, що `app/lib/calc/` тримає проти react/next).
//
// Що таке "свіжість": скільки днів минуло від `verified_at` правила. Правило
// НЕ стає хибним від віку — воно стає вартим повторної звірки з джерелом
// (.claude/rules/evidence-numbers.md). Поріг за замовчуванням — 90 днів,
// той самий, що в `scripts/check-stale-rules.mjs`; парність двох реалізацій
// закріплена тестом (store.parity.test.ts), а не довірою.

import * as fs from "node:fs";

export const DEFAULT_MAX_AGE_DAYS = 90;

export type FreshnessFilter = "all" | "stale" | "fresh";

export interface RawRule {
  rule_id: string;
  params: Record<string, unknown>;
  source_url: string;
  verified_at: string; // ISO-дата останньої звірки з джерелом
}

export interface RulesFile {
  tax_year: number;
  profile: string;
  verified_at: string;
  rules: RawRule[];
}

// Правило + похідні поля свіжості. `params` навмисно НЕ входить сюди:
// список правил не має розсипати цифри по контексту моделі, їх віддає
// лише get_rule, разом із джерелом і віком.
export interface RuleFreshness {
  rule_id: string;
  verified_at: string;
  age_days: number;
  stale: boolean;
  source_url: string;
}

export interface RuleDetail extends RuleFreshness {
  params: Record<string, unknown>;
}

export interface FreshnessReport {
  tax_year: number;
  threshold_days: number;
  checked: number;
  stale: number;
  fresh: number;
  stalest?: { rule_id: string; verified_at: string; age_days: number };
  generated_at: string;
}

// Окремий клас помилки: MCP-шар ловить саме її і перетворює на isError
// з підказкою наступного кроку. Все інше летить нагору як невідома помилка.
export class RuleNotFoundError extends Error {
  constructor(public readonly ruleId: string) {
    super(`Rule with id "${ruleId}" not found`);
    this.name = "RuleNotFoundError";
  }
}

export class EvidenceStore {
  private file?: RulesFile;

  // `now` інжектиться, щоб тести не залежали від сьогоднішньої дати:
  // вік правила — рухома цифра, і без фіксованого "зараз" еталон розповзеться.
  constructor(
    private readonly filePath: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  load(): void {
    const raw = fs.readFileSync(this.filePath, "utf8");
    const data = JSON.parse(raw) as RulesFile;
    if (!Array.isArray(data.rules)) {
      throw new Error(`${this.filePath}: очікувався масив rules`);
    }
    this.file = data;
  }

  private data(): RulesFile {
    if (!this.file) {
      throw new Error("EvidenceStore.load() не викликано");
    }
    return this.file;
  }

  get taxYear(): number {
    return this.data().tax_year;
  }

  // Вік у повних днях від verified_at до "зараз". Floor, як у
  // scripts/check-stale-rules.mjs — інакше два джерела правди про
  // "протерміноване" розійшлись би на день.
  private ageDays(verifiedAt: string): number {
    const verified = new Date(`${verifiedAt}T00:00:00Z`);
    return Math.floor((this.now().getTime() - verified.getTime()) / 86_400_000);
  }

  private freshnessOf(rule: RawRule, thresholdDays: number): RuleFreshness {
    const age_days = this.ageDays(rule.verified_at);
    return {
      rule_id: rule.rule_id,
      verified_at: rule.verified_at,
      age_days,
      stale: age_days > thresholdDays, // строго більше, як у скрипті
      source_url: rule.source_url,
    };
  }

  listRules(
    filter: FreshnessFilter = "all",
    thresholdDays: number = DEFAULT_MAX_AGE_DAYS,
  ): RuleFreshness[] {
    const all = this.data().rules.map((rule) => this.freshnessOf(rule, thresholdDays));
    const filtered =
      filter === "all" ? all : all.filter((r) => (filter === "stale" ? r.stale : !r.stale));
    return filtered.sort((a, b) => b.age_days - a.age_days);
  }

  // Кидає RuleNotFoundError на невідомий id. Рішення "що з цим робити"
  // приймає шар вище (MCP handler).
  getRule(ruleId: string, thresholdDays: number = DEFAULT_MAX_AGE_DAYS): RuleDetail {
    const rule = this.data().rules.find((r) => r.rule_id === ruleId);
    if (!rule) {
      throw new RuleNotFoundError(ruleId);
    }
    return { ...this.freshnessOf(rule, thresholdDays), params: rule.params };
  }

  freshness(thresholdDays: number = DEFAULT_MAX_AGE_DAYS): FreshnessReport {
    const all = this.listRules("all", thresholdDays);
    const stale = all.filter((r) => r.stale);
    const stalest = all[0]; // listRules віддає відсортовано за віком спадно
    return {
      tax_year: this.taxYear,
      threshold_days: thresholdDays,
      checked: all.length,
      stale: stale.length,
      fresh: all.length - stale.length,
      stalest: stalest
        ? {
            rule_id: stalest.rule_id,
            verified_at: stalest.verified_at,
            age_days: stalest.age_days,
          }
        : undefined,
      generated_at: this.now().toISOString(),
    };
  }

  // Інваріант даних із .claude/rules/evidence-numbers.md: кожне правило
  // несе source_url + verified_at. Повертає список порушників, а не кидає —
  // рішення знову за шаром вище (сервер віддає це як isError).
  missingEvidence(): string[] {
    return this.data()
      .rules.filter((r) => !r.source_url || !r.verified_at)
      .map((r) => r.rule_id);
  }
}
