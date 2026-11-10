import { expect, it } from "vitest";
import { annualPlanUrl, resolveAnnualPlanParams } from "../src/lib/annual-planning";
it("normaliza anos, autor e paginação e preserva consulta em URL", () => {
  const now = new Date(2026, 5, 1);
  expect(resolveAnnualPlanParams({ sourceYear: "2099", targetYear: "2027", author: "me", page: "2" }, now)).toEqual({ sourceYear: 2099, targetYear: 2027, author: "me", page: 2 });
  expect(resolveAnnualPlanParams({ sourceYear: "1899", targetYear: ["2027", "2028"], page: "-1" }, now)).toEqual({ sourceYear: 2025, targetYear: 2026, author: "", page: 1 });
  expect(annualPlanUrl({ sourceYear: 2025, targetYear: 2026, author: "bob", page: 3 })).toBe("/planejamento-anual?sourceYear=2025&targetYear=2026&author=bob&page=3");
});
