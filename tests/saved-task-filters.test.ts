import { describe, expect, it } from "vitest";
import { addSavedFilter, canonicalFilterUrl, readSavedFilters, savedFiltersKey } from "../src/lib/saved-task-filters";
import { resolveTaskListParams } from "../src/lib/task-list-params";

describe("consultas favoritas", () => {
  it("preserva filtros aplicados, remove paginação e normaliza vencidas", () => {
    const filters = resolveTaskListParams({ q: " relatório ", status: "VALIDATED", overdue: "true", from: "2026-01-01", to: "2026-12-31", focalPoint: "1001", page: "4" });
    const [saved] = addSavedFilter([], "  Pendências  ", filters);
    expect(saved.name).toBe("Pendências");
    expect(Object.fromEntries(new URL(saved.href, "https://agenda.invalid").searchParams)).toEqual({ q: "relatório", status: "PENDING", overdue: "true", from: "2026-01-01", to: "2026-12-31", focalPoint: "1001" });
  });
  it.each(["https://evil.invalid/tarefas", "//evil.invalid/tarefas", "javascript:alert(1)", "/usuarios", "/tarefas#evil", "/tarefas?from=2026-02-30", "/tarefas?focalPoint=1&focalPoint=2"])("descarta destino inválido: %s", (href) => expect(canonicalFilterUrl(href)).toBeNull());
  it("tolera dados corrompidos e reconstrói apenas filtros reconhecidos", () => {
    expect(readSavedFilters("{oops")).toEqual([]);
    expect(readSavedFilters('{}')).toEqual([]);
    expect(readSavedFilters(JSON.stringify([null, { name: 3 }, { name: "Seguro", href: "/tarefas?q=abc&page=9&redirect=evil" }, { name: "seguro", href: "/tarefas" }]))).toEqual([{ name: "Seguro", href: "/tarefas?q=abc" }]);
  });
  it("valida nome, duplicatas, filtros e limite", () => {
    const filters = resolveTaskListParams({});
    expect(() => addSavedFilter([], " ", filters)).toThrow("nome");
    expect(() => addSavedFilter([], "a".repeat(51), filters)).toThrow("nome");
    expect(() => addSavedFilter([{ name: "Equipe", href: "/tarefas" }], "EQUIPE", filters)).toThrow("Já existe");
    expect(() => addSavedFilter([], "Nome", resolveTaskListParams({ from: "bad" }))).toThrow("Corrija");
    const saved = Array.from({ length: 12 }, (_, i) => ({ name: `Consulta ${i}`, href: "/tarefas" }));
    expect(readSavedFilters(JSON.stringify(saved))).toHaveLength(10);
    expect(() => addSavedFilter(saved, "Nova", filters)).toThrow("10 favoritos");
  });
  it("separa usuário, unidade e caracteres especiais nas chaves", () => {
    expect(savedFiltersKey("a:b", "c")).not.toBe(savedFiltersKey("b", "c:a"));
    expect(savedFiltersKey("a", "u")).not.toBe(savedFiltersKey("b", "u"));
    expect(savedFiltersKey("a", "u")).not.toBe(savedFiltersKey("a", "v"));
  });
});
