import { describe, expect, it } from "vitest";
import { resolveTaskListParams, taskListUrl } from "../src/lib/task-list-params";

describe("parâmetros da lista", () => {
  it("usa padrões seguros", () => { expect(resolveTaskListParams({})).toEqual({ q: "", status: "ALL", overdue: false, page: 1 }); });
  it("normaliza busca, restringe tamanho e recusa estado desconhecido", () => {
    expect(resolveTaskListParams({ q: "  buscar  ", status: "ADMIN" })).toMatchObject({ q: "buscar", status: "ALL" });
    expect(resolveTaskListParams({ q: "x".repeat(200) }).q).toHaveLength(120);
  });
  it("vencidas prioriza pendências mantendo a busca", () => { expect(resolveTaskListParams({ overdue: "true", status: "VALIDATED", q: "remessa" })).toMatchObject({ status: "PENDING", q: "remessa", overdue: true }); });
  it.each(["-1", "1.5", "NaN", "0", "9999999999999999999999"])("recusa página %s", (page) => { expect(resolveTaskListParams({ page }).page).toBe(1); });
  it("recusa parâmetros duplicados", () => { expect(resolveTaskListParams({ q: ["a", "b"], overdue: ["true"], status: ["PENDING"], page: ["2"] })).toEqual({ q: "", overdue: false, status: "ALL", page: 1 }); });
  it("serializa filtros e preserva busca na paginação", () => {
    const filters = resolveTaskListParams({ q: "a & b", overdue: "true" });
    const url = new URL(taskListUrl(filters, 2), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "a & b", status: "PENDING", overdue: "true", page: "2" });
    expect(taskListUrl(resolveTaskListParams({}))).toBe("/tarefas");
  });
});
