// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskListPage from "../src/app/tarefas/page";
import { operator } from "./helpers/fixtures";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../src/lib/task-list", () => ({ getTaskListData: mocks.load }));
vi.mock("../src/components/TaskList", () => ({ default: () => <div>Resultados</div> }));
afterEach(cleanup);
beforeEach(() => mocks.load.mockResolvedValue({ currentUser: operator, tasks: [], employees: [], total: 26, page: 1, pages: 2, focalOptions: [{ id: 1001, name: "Pessoa da unidade" }] }));
describe("formulário de filtros", () => {
  it("mantém campos acessíveis e valores aplicados em GET sem conservar a página anterior", async () => {
    render(await TaskListPage({ searchParams: Promise.resolve({ focalPoint: "1001", from: "2026-01-01", to: "2026-01-31", q: "remessa", page: "2" }) }));
    const form = screen.getByRole("form", { name: "Buscar e filtrar tarefas" }) as HTMLFormElement;
    expect(form.method).toBe("get");
    const fields = new FormData(form);
    expect(Object.fromEntries(fields)).toMatchObject({ focalPoint: "1001", from: "2026-01-01", to: "2026-01-31", q: "remessa" });
    expect(fields.has("page")).toBe(false);
    expect(screen.getByLabelText("Prazo até").getAttribute("aria-describedby")).toBe("date-filter-help");
    expect(screen.getByRole("link", { name: "Limpar filtros" }).getAttribute("href")).toBe("/tarefas");
  });
  it("explica intervalo inválido e mantém opção indisponível sem expor outro cadastro", async () => {
    render(await TaskListPage({ searchParams: Promise.resolve({ from: "2026-02-02", to: "2026-01-01", focalPoint: "9999" }) }));
    expect(screen.getByRole("alert").textContent).toContain("prazo inicial");
    expect((screen.getByLabelText("Ponto focal") as HTMLSelectElement).value).toBe("9999");
    expect(screen.getByRole("option", { name: "Ponto focal indisponível nesta unidade" })).toBeTruthy();
  });
  it("preserva datas e ponto focal na paginação", async () => {
    render(await TaskListPage({ searchParams: Promise.resolve({ from: "2026-01-01", to: "2026-01-31", focalPoint: "1001" }) }));
    const href = screen.getByRole("link", { name: "Próxima página" }).getAttribute("href")!;
    expect(Object.fromEntries(new URL(href,"http://localhost").searchParams)).toEqual({ from: "2026-01-01", to: "2026-01-31", focalPoint: "1001", page: "2" });
  });
});
