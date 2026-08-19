// Тести шару даних. Вік правила — рухома цифра, тож "зараз" зафіксоване:
// без цього еталон розповзеться сам собою наступного дня.
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { DEFAULT_MAX_AGE_DAYS, EvidenceStore, RuleNotFoundError } from "./store.js";
import { getStaleRules } from "../../../scripts/check-stale-rules.mjs";

const FIXTURE = fileURLToPath(new URL("./__fixtures__/rules.fixture.json", import.meta.url));
const FIXTURE_MISSING = fileURLToPath(
  new URL("./__fixtures__/rules.missing-evidence.fixture.json", import.meta.url),
);
const REAL_RULES = fileURLToPath(new URL("../../../app/lib/rules/rules.2026.json", import.meta.url));

// 2026-08-19 обрано так, щоб дати фікстури дали рівно 18 / 90 / 91 / 595 днів.
const NOW = () => new Date("2026-08-19T00:00:00Z");

function loaded(file = FIXTURE) {
  const store = new EvidenceStore(file, NOW);
  store.load();
  return store;
}

describe("EvidenceStore — вік і фільтри", () => {
  it("рахує вік у повних днях від verified_at", () => {
    const byId = Object.fromEntries(loaded().listRules("all").map((r) => [r.rule_id, r.age_days]));

    // Виведено вручну: 2026-08-01 → 18 днів (серпень: 19 − 1).
    expect(byId["fixture.fresh"]).toBe(18);
    // 2026-05-21 → 10 (травень) + 30 (червень) + 31 (липень) + 19 (серпень) = 90.
    expect(byId["fixture.exactly_at_threshold"]).toBe(90);
    // На день раніше — рівно на день більше.
    expect(byId["fixture.one_day_over"]).toBe(91);
    // 2025-01-01 → 365 + 212 + 18 = 595.
    expect(byId["fixture.ancient"]).toBe(595);
  });

  it("межа порогу: рівно 90 днів ще не старе, 91 — вже старе", () => {
    const stale = loaded().listRules("stale", DEFAULT_MAX_AGE_DAYS).map((r) => r.rule_id);

    expect(stale).toContain("fixture.one_day_over");
    expect(stale).not.toContain("fixture.exactly_at_threshold");
  });

  it("сортує від найстарішого до найсвіжішого", () => {
    expect(loaded().listRules("all").map((r) => r.rule_id)).toEqual([
      "fixture.ancient",
      "fixture.one_day_over",
      "fixture.exactly_at_threshold",
      "fixture.fresh",
    ]);
  });

  it("fresh — доповнення stale, разом дають усі правила", () => {
    const store = loaded();
    const all = store.listRules("all").length;

    expect(store.listRules("stale").length + store.listRules("fresh").length).toBe(all);
  });

  it("інший поріг рухає межу", () => {
    // Поріг 17 днів робить старим навіть найсвіжіше правило (18 днів).
    expect(loaded().listRules("stale", 17)).toHaveLength(4);
    // Поріг 600 не лишає старих узагалі.
    expect(loaded().listRules("stale", 600)).toHaveLength(0);
  });

  it("listRules не віддає params — цифри йдуть лише через get_rule", () => {
    for (const rule of loaded().listRules("all")) {
      expect(rule).not.toHaveProperty("params");
    }
  });
});

describe("EvidenceStore — одне правило", () => {
  it("getRule віддає params, джерело і вік", () => {
    const rule = loaded().getRule("fixture.one_day_over");

    expect(rule.params).toEqual({ rate: 0.085 });
    expect(rule.source_url).toBe("https://www.podatki.gov.pl/fixture-over");
    expect(rule.age_days).toBe(91);
    expect(rule.stale).toBe(true);
  });

  it("невідомий id кидає RuleNotFoundError, а не повертає порожнечу", () => {
    expect(() => loaded().getRule("fixture.nope")).toThrow(RuleNotFoundError);
  });
});

describe("EvidenceStore — зведення", () => {
  it("freshness рахує checked / stale / fresh і найстаріше правило", () => {
    const report = loaded().freshness();

    expect(report).toMatchObject({
      tax_year: 2026,
      threshold_days: 90,
      checked: 4,
      stale: 2,
      fresh: 2,
      stalest: { rule_id: "fixture.ancient", verified_at: "2025-01-01", age_days: 595 },
    });
  });

  it("missingEvidence ловить правило без source_url", () => {
    const store = new EvidenceStore(FIXTURE_MISSING, NOW);
    store.load();

    expect(store.missingEvidence()).toEqual(["fixture.no_source"]);
  });
});

describe("реальні правила репозиторію", () => {
  it("кожне правило несе source_url і verified_at (evidence-numbers.md)", () => {
    const store = new EvidenceStore(REAL_RULES);
    store.load();

    expect(store.missingEvidence()).toEqual([]);
    expect(store.taxYear).toBe(2026);
  });

  // Анти-регрес на розходження двох реалізацій "що вважати протермінованим":
  // scripts/check-stale-rules.mjs годує SessionStart-хук, EvidenceStore — MCP.
  // Різні пороги в них означали б, що хук і сервер кажуть людині різне.
  it("парність зі scripts/check-stale-rules.mjs на тому самому порозі", () => {
    const store = new EvidenceStore(REAL_RULES);
    store.load();
    const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const previousCwd = process.cwd();

    try {
      process.chdir(repoRoot); // скрипт читає шлях відносно cwd
      for (const threshold of [30, 90, 365]) {
        const fromScript = getStaleRules(threshold).map((r: { rule_id: string }) => r.rule_id);
        const fromStore = store.listRules("stale", threshold).map((r) => r.rule_id);
        expect(fromStore).toEqual(fromScript);
      }
    } finally {
      process.chdir(previousCwd);
    }
  });
});
