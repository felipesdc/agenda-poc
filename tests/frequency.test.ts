import { describe, expect, it } from "vitest";
import type { Frequency } from "@prisma/client";
import { calculateNextDueDate } from "../src/lib/frequency";

describe("recorrência", () => {
  const cases: [Frequency, number, number, number][] = [
    ["WEEKLY", 2026, 0, 22],
    ["BIWEEKLY", 2026, 0, 29],
    ["MONTHLY", 2026, 1, 15],
    ["BIMONTHLY", 2026, 2, 15],
    ["QUARTERLY", 2026, 3, 15],
    ["SEMIANNUAL", 2026, 6, 15],
    ["ANNUAL", 2027, 0, 15],
  ];

  it.each(cases)("calcula a próxima data de %s sem modificar a origem", (frequency, year, month, day) => {
    const origin = new Date(2026, 0, 15, 12, 30);
    const before = origin.getTime();
    expect(calculateNextDueDate(origin, frequency)).toEqual(new Date(year, month, day, 12, 30));
    expect(origin.getTime()).toBe(before);
  });

  it.each(["NONE", "EVENTUAL"] as const)("não gera próxima data para %s", (frequency) => {
    expect(calculateNextDueDate(new Date(2026, 0, 15, 12), frequency)).toBeNull();
  });

  it("ajusta o dia 31 para o último dia de fevereiro", () => {
    expect(calculateNextDueDate(new Date(2026, 0, 31, 12), "MONTHLY")).toEqual(new Date(2026, 1, 28, 12));
    expect(calculateNextDueDate(new Date(2028, 0, 31, 12), "MONTHLY")).toEqual(new Date(2028, 1, 29, 12));
  });

  it("trata ano bissexto e passagem de ano", () => {
    expect(calculateNextDueDate(new Date(2028, 1, 29, 12), "ANNUAL")).toEqual(new Date(2029, 1, 28, 12));
    expect(calculateNextDueDate(new Date(2026, 11, 28, 12), "WEEKLY")).toEqual(new Date(2027, 0, 4, 12));
  });
});
