import { describe, expect, it } from "vitest";
import { resolveCalendarParams } from "../src/lib/calendar-params";

const now = new Date(2026, 10, 7, 12);
describe("parâmetros de calendário", () => {
  it("usa o período atual quando os parâmetros estão ausentes", () => {
    expect(resolveCalendarParams({}, now)).toEqual({ month: 10, year: 2026, view: "month", archived: false });
  });
  it("preserva janeiro e aceita os limites de ano", () => {
    expect(resolveCalendarParams({ month: "0", year: "1900", view: "year", archived: "true" }, now)).toEqual({ month: 0, year: 1900, view: "year", archived: true });
    expect(resolveCalendarParams({ month: "11", year: "2100" }, now)).toMatchObject({ month: 11, year: 2100 });
  });
  it.each(["", "-1", "12", "1.5", "NaN", "Infinity", "1e1", " 1", ["0", "1"]])("mês inválido %s usa o atual sem produzir Invalid Date", (month) => {
    expect(resolveCalendarParams({ month }, now).month).toBe(10);
  });
  it.each(["", "0", "1899", "2101", "-1", "2026.5", "NaN", ["2025", "2026"]])("ano inválido %s usa o atual", (year) => {
    expect(resolveCalendarParams({ year }, now).year).toBe(2026);
  });
  it("não trata parâmetros duplicados como uma escolha válida", () => {
    expect(resolveCalendarParams({ view: ["year", "month"], archived: ["true", "false"] }, now)).toMatchObject({ view: "month", archived: false });
  });
});
