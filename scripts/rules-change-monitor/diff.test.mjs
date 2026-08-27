import { describe, it, expect } from "vitest";
import { compareValues } from "./diff.mjs";
import { STATES, STATES_IN_SCOPE } from "./states.mjs";

const base = {
  rule_id: "pl-zdrowotna-skladka",
  source_url: "https://zus.pl/example",
  verified_at: "2026-08-01",
};

describe("compareValues", () => {
  it("fetched_raw порожній (null) → unavailable", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: null });
    expect(r.state).toBe(STATES.UNAVAILABLE);
    expect(r.fetched_value).toBeNull();
    expect(r.diff_percent).toBeNull();
    expect(r.failure_reason).not.toBeNull();
  });

  it("fetched_raw порожній рядок → unavailable", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "" });
    expect(r.state).toBe(STATES.UNAVAILABLE);
  });

  it("переданий failure_reason незалежно від fetched_raw → unavailable", () => {
    const r = compareValues({
      ...base,
      matrix_value: 4806,
      fetched_raw: "4806.00",
      failure_reason: "timeout з мережі",
    });
    expect(r.state).toBe(STATES.UNAVAILABLE);
    expect(r.fetched_value).toBeNull();
    expect(r.diff_percent).toBeNull();
    expect(r.failure_reason).toBe("timeout з мережі");
  });

  it("однакові числа й ідентичні сирі рядки → match", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "4806" });
    expect(r.state).toBe(STATES.MATCH);
    expect(r.fetched_value).toBe(4806);
    expect(r.diff_percent).toBeNull();
  });

  it("однакові числа, різний формат сирого рядка → cosmetic (AC-04)", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "4 806,00 zł" });
    expect(r.state).toBe(STATES.COSMETIC);
    expect(r.fetched_value).toBe(4806);
    expect(r.diff_percent).toBe(0);
  });

  it("cosmetic з нерозривним пробілом U+00A0 у сирому значенні", () => {
    const r = compareValues({ ...base, matrix_value: 1620, fetched_raw: "1 620,00" });
    expect(r.state).toBe(STATES.COSMETIC);
    expect(r.fetched_value).toBe(1620);
  });

  it("cosmetic з відсотком '9,00%' проти матриці 9", () => {
    const r = compareValues({ ...base, matrix_value: 9, fetched_raw: "9,00%" });
    expect(r.state).toBe(STATES.COSMETIC);
    expect(r.fetched_value).toBe(9);
    expect(r.diff_percent).toBe(0);
  });

  it("різні числа → divergence, diff_percent додатний при зростанні", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "4900.00" });
    expect(r.state).toBe(STATES.DIVERGENCE);
    expect(r.fetched_value).toBe(4900);
    // (4900 - 4806) / 4806 * 100
    expect(r.diff_percent).toBeCloseTo(1.96, 2);
    expect(r.diff_percent).toBeGreaterThan(0);
  });

  it("падіння ставки → diff_percent відʼємний", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "4700.00" });
    expect(r.state).toBe(STATES.DIVERGENCE);
    expect(r.diff_percent).toBeLessThan(0);
    expect(r.diff_percent).toBeCloseTo(-2.2, 1);
  });

  it("matrix_value = 0 → divergence, diff_percent: null (ділення на нуль не рахуємо)", () => {
    const r = compareValues({ ...base, matrix_value: 0, fetched_raw: "100.00" });
    expect(r.state).toBe(STATES.DIVERGENCE);
    expect(r.diff_percent).toBeNull();
  });

  /**
   * AC-05 визначає divergence як «інше число після нормалізації». Коли з боку
   * матриці числа немає взагалі, «іншого числа» не існує — це нічого, з чим
   * порівняти, тобто `unavailable`. Перша версія тесту фіксувала протилежне і
   * була підгонкою еталона під код (знайшло рев'ю з чистим контекстом).
   */
  it("matrix_value не число ('brak' у матриці) → unavailable, а не divergence", () => {
    const r = compareValues({ ...base, matrix_value: "brak", fetched_raw: "100.00" });
    expect(r.state).toBe(STATES.UNAVAILABLE);
    expect(r.diff_percent).toBeNull();
    expect(r.failure_reason).toMatch(/matrix_value/);
  });

  it("нуль у матриці — розбіжність без відсотка, ділити нема на що", () => {
    const r = compareValues({ ...base, matrix_value: 0, fetched_raw: "100,00 zł" });
    expect(r.state).toBe(STATES.DIVERGENCE);
    expect(r.diff_percent).toBeNull();
  });

  it("несе сторінку, з якої взято число, окремо від source_url матриці", () => {
    const r = compareValues({
      ...base,
      matrix_value: 4806,
      fetched_raw: "5 000 zł",
      fetched_from: "https://www.zus.pl/baza-wiedzy/skladki",
      source_url: "https://www.zus.pl/en/-/nowe-wysokosci",
    });
    expect(r.fetched_from).toBe("https://www.zus.pl/baza-wiedzy/skladki");
    expect(r.source_url).toBe("https://www.zus.pl/en/-/nowe-wysokosci");
  });

  it("fetched_raw є, але не нормалізується (сміття) → unavailable, не divergence", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "strona niedostępna" });
    expect(r.state).toBe(STATES.UNAVAILABLE);
    expect(r.fetched_value).toBeNull();
    expect(r.diff_percent).toBeNull();
    expect(r.failure_reason).not.toBeNull();
  });

  it("інваріант: стан завжди зі STATES_IN_SCOPE", () => {
    const cases = [
      { ...base, matrix_value: 4806, fetched_raw: null },
      { ...base, matrix_value: 4806, fetched_raw: "4806" },
      { ...base, matrix_value: 4806, fetched_raw: "4 806,00" },
      { ...base, matrix_value: 4806, fetched_raw: "9999" },
      { ...base, matrix_value: 0, fetched_raw: "100" },
      { ...base, matrix_value: 4806, fetched_raw: "sміття" },
      { ...base, matrix_value: 4806, fetched_raw: "4806", failure_reason: "boom" },
    ];
    for (const c of cases) {
      const r = compareValues(c);
      expect(STATES_IN_SCOPE).toContain(r.state);
    }
  });

  it("зберігає source_url і verified_at наскрізь", () => {
    const r = compareValues({ ...base, matrix_value: 4806, fetched_raw: "4806" });
    expect(r.source_url).toBe(base.source_url);
    expect(r.verified_at).toBe(base.verified_at);
    expect(r.rule_id).toBe(base.rule_id);
  });
});
