// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SavedTaskFilters from "../src/components/SavedTaskFilters";
import { resolveTaskListParams } from "../src/lib/task-list-params";
import { savedFiltersKey } from "../src/lib/saved-task-filters";
const mocks = vi.hoisted(() => ({ getSavedTaskFilters: vi.fn(), addAccountFilter: vi.fn(), removeAccountFilter: vi.fn() }));
vi.mock("@/actions/saved-filters", () => mocks);
const filters = resolveTaskListParams({ q: "remessa", focalPoint: "1001", page: "3" });
const props = { userId: "alice", unitId: "unit", filters };
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); mocks.getSavedTaskFilters.mockResolvedValue({ success: true, items: [] }); mocks.addAccountFilter.mockResolvedValue({ success: true, message: "Favorito salvo." }); mocks.removeAccountFilter.mockResolvedValue({ success: true, message: "Favorito removido." }); });
afterEach(cleanup);
it("salva consulta aplicada na conta e remove pela identidade", async () => {
  const user = userEvent.setup(); render(<SavedTaskFilters {...props} />); await screen.findByText("Nenhum filtro favorito salvo na sua conta.");
  mocks.getSavedTaskFilters.mockResolvedValue({ success: true, items: [{ id: "1", name: "Remessas", href: "/tarefas?q=remessa&focalPoint=1001" }] });
  await user.type(screen.getByLabelText("Nome do favorito"), "Remessas"); await user.click(screen.getByRole("button", { name: "Salvar consulta atual" }));
  expect(mocks.addAccountFilter).toHaveBeenCalledWith("Remessas", "/tarefas?q=remessa&focalPoint=1001");
  expect(await screen.findByRole("link", { name: "Remessas (atual)" })).toBeTruthy();
  mocks.getSavedTaskFilters.mockResolvedValue({ success: true, items: [] }); await user.click(screen.getByRole("button", { name: "Remover favorito Remessas" }));
  expect(mocks.removeAccountFilter).toHaveBeenCalledWith("1"); await screen.findByText("Nenhum filtro favorito salvo na sua conta.");
});
it("preserva favoritos locais durante importação parcial", async () => {
  localStorage.setItem(savedFiltersKey("alice", "unit"), JSON.stringify([{ name: "Primeiro", href: "/tarefas" }, { name: "Segundo", href: "/tarefas?q=b" }]));
  mocks.addAccountFilter.mockResolvedValueOnce({ success: true, message: "Salvo" }).mockResolvedValueOnce({ success: false, message: "Duplicado" });
  const user = userEvent.setup(); render(<SavedTaskFilters {...props} />); await screen.findByText(/2 favorito/); await screen.findByText("Nenhum filtro favorito salvo na sua conta.");
  await user.click(screen.getByRole("button", { name: "Importar favoritos locais" }));
  expect((await screen.findByRole("status")).textContent).toContain("1 favorito(s) importado(s)");
  expect(JSON.parse(localStorage.getItem(savedFiltersKey("alice", "unit"))!)).toEqual([{ name: "Segundo", href: "/tarefas?q=b" }]);
});
it("exibe falha e preserva nome para nova tentativa", async () => {
  mocks.addAccountFilter.mockResolvedValueOnce({ success: false, message: "Já existe" });
  const user = userEvent.setup(); render(<SavedTaskFilters {...props} />); await screen.findByText("Nenhum filtro favorito salvo na sua conta.");
  await user.type(screen.getByLabelText("Nome do favorito"), "Equipe"); await user.click(screen.getByRole("button", { name: "Salvar consulta atual" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Já existe"); expect(screen.getByLabelText("Nome do favorito")).toHaveProperty("value", "Equipe");
});
it("impede salvar filtros inválidos", async () => {
  render(<SavedTaskFilters {...props} filters={resolveTaskListParams({ from: "bad" })} />); await screen.findByText("Nenhum filtro favorito salvo na sua conta.");
  expect(screen.getByRole("button", { name: "Salvar consulta atual" })).toHaveProperty("disabled", true);
});
