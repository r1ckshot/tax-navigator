import { describe, it, expect } from "vitest";
import { normalizeNumber, sameAfterNormalize } from "./normalize.mjs";

describe("normalizeNumber", () => {
  it("парсить польський формат зі звичайним пробілом і комою: '4 806,00 zł'", () => {
    expect(normalizeNumber("4 806,00 zł")).toBe(4806);
  });

  it("парсить нерозривний пробіл U+00A0 як роздільник тисяч", () => {
    expect(normalizeNumber("4 806,00")).toBe(4806);
  });

  it("парсить вузький нерозривний пробіл U+202F як роздільник тисяч", () => {
    expect(normalizeNumber("4 806,00")).toBe(4806);
  });

  it("парсить вже крапковий десятковий формат: '4806.00'", () => {
    expect(normalizeNumber("4806.00")).toBe(4806);
  });

  it("парсить відсоток: '9,00%' → 9", () => {
    expect(normalizeNumber("9,00%")).toBe(9);
  });

  it("парсить '1 620,00'", () => {
    expect(normalizeNumber("1 620,00")).toBe(1620);
  });

  it("пропускає вже готовий number наскрізь", () => {
    expect(normalizeNumber(4806)).toBe(4806);
  });

  it("порожній рядок → null", () => {
    expect(normalizeNumber("")).toBeNull();
  });

  it("null → null", () => {
    expect(normalizeNumber(null)).toBeNull();
  });

  it("прочерк '—' → null", () => {
    expect(normalizeNumber("—")).toBeNull();
  });

  it("рядок без жодної цифри → null", () => {
    expect(normalizeNumber("brak danych")).toBeNull();
  });

  it("НЕ вгадує формат з двома різними роздільниками: '1,234,567' → null", () => {
    // Польський запис так не пише (кома там завжди одна, десяткова) —
    // мовчазна здогадка тут коштувала б неправильної ставки.
    expect(normalizeNumber("1,234,567")).toBeNull();
  });

  it("НЕ вгадує формат з кількома крапками: '1.234.567' → null", () => {
    expect(normalizeNumber("1.234.567")).toBeNull();
  });

  it("undefined → null", () => {
    expect(normalizeNumber(undefined)).toBeNull();
  });

  it("NaN (як number) → null", () => {
    expect(normalizeNumber(NaN)).toBeNull();
  });
});

describe("sameAfterNormalize", () => {
  it("те саме число в різних форматах — рівні", () => {
    expect(sameAfterNormalize("4 806,00 zł", "4806.00")).toBe(true);
  });

  it("різні числа — не рівні", () => {
    expect(sameAfterNormalize("4 806,00", "4 900,00")).toBe(false);
  });

  it("допуск на копійки < 0.005", () => {
    expect(sameAfterNormalize("4806.001", "4806.004")).toBe(true);
  });

  it("різниця рівно на межі допуску (>= 0.005) — не рівні", () => {
    expect(sameAfterNormalize("4806.000", "4806.005")).toBe(false);
  });

  it("якщо одне з двох не нормалізується — не рівні", () => {
    expect(sameAfterNormalize("4806.00", "brak danych")).toBe(false);
  });
});
