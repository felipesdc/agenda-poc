import { describe, expect, it } from "vitest";
import { resolveTaskListParams, taskListUrl } from "../src/lib/task-list-params";

describe("parâmetros da lista", () => {
  it("usa padrões seguros", () => { expect(resolveTaskListParams({})).toEqual({ q: "", status: "ALL", overdue: false, page: 1, focalPoint: null, from: "", to: "", errors: [] }); });
  it("normaliza busca, restringe tamanho e recusa estado desconhecido", () => {
    expect(resolveTaskListParams({ q: "  buscar  ", status: "ADMIN" })).toMatchObject({ q: "buscar", status: "ALL" });
    expect(resolveTaskListParams({ q: "x".repeat(200) }).q).toHaveLength(120);
  });
  it("vencidas prioriza pendências mantendo a busca", () => { expect(resolveTaskListParams({ overdue: "true", status: "VALIDATED", q: "remessa" })).toMatchObject({ status: "PENDING", q: "remessa", overdue: true }); });
  it.each(["-1", "1.5", "NaN", "0", "9999999999999999999999"])("recusa página %s", (page) => { expect(resolveTaskListParams({ page }).page).toBe(1); });
  it("recusa parâmetros duplicados", () => { expect(resolveTaskListParams({ q: ["a", "b"], overdue: ["true"], status: ["PENDING"], page: ["2"] })).toEqual({ q: "", overdue: false, status: "ALL", page: 1, focalPoint: null, from: "", to: "", errors: [] }); });
  it("serializa filtros e preserva busca na paginação", () => {
    const filters = resolveTaskListParams({ q: "a & b", overdue: "true" });
    const url = new URL(taskListUrl(filters, 2), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "a & b", status: "PENDING", overdue: "true", page: "2" });
    expect(taskListUrl(resolveTaskListParams({}))).toBe("/tarefas");
  });
});

describe("ponto focal e datas", () => {
  it("aceita data bissexta e matrícula Int32", () => {
    expect(resolveTaskListParams({ focalPoint: "2147483647", from: "2028-02-29", to: "2028-03-01" })).toMatchObject({ focalPoint: 2147483647, errors: [] });
  });
  it.each(["0", "-1", "1.5", "2147483648", "abc"])("recusa matrícula %s", (focalPoint) => {
    expect(resolveTaskListParams({ focalPoint }).errors).toContain("Selecione um ponto focal válido.");
  });
  it.each(["2026-02-29", "2026-13-01", "01/01/2026", "2026-01-01T00:00:00Z"])("recusa data %s", (from) => {
    expect(resolveTaskListParams({ from }).errors).toContain("Informe uma data inicial válida.");
  });
  it("recusa intervalo invertido e filtros duplicados", () => {
    expect(resolveTaskListParams({ from: "2026-12-02", to: "2026-12-01" }).errors).toHaveLength(1);
    expect(resolveTaskListParams({ from: ["2026-01-01"], to: ["2026-02-01"], focalPoint: ["1001"] }).errors).toHaveLength(3);
  });
  it("preserva todos os filtros na página seguinte", () => {
    const filters = resolveTaskListParams({ q: "teste", status: "PENDING", overdue: "true", focalPoint: "1001", from: "2020-01-01", to: "2026-12-31" });
    const url = new URL(taskListUrl(filters, 2), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "teste", status: "PENDING", overdue: "true", focalPoint: "1001", from: "2020-01-01", to: "2026-12-31", page: "2" });
  });
});
