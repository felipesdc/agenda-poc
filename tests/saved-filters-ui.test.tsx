// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SavedTaskFilters from "../src/components/SavedTaskFilters";
import { resolveTaskListParams } from "../src/lib/task-list-params";
import { savedFiltersKey } from "../src/lib/saved-task-filters";
const filters = resolveTaskListParams({ q: "remessa", focalPoint: "1001", page: "3" });
const props = { userId: "alice", unitId: "unit", filters };
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it("salva consulta aplicada, mantém favorito após remontar e permite remover", async () => {
  const user = userEvent.setup();
  const view = render(<SavedTaskFilters {...props} />);
  await user.type(screen.getByLabelText("Nome do favorito"), "Remessas");
  await user.click(screen.getByRole("button", { name: "Salvar consulta atual" }));
  expect(screen.getByRole("status").textContent).toBe("Favorito salvo.");
  expect(screen.getByRole("link", { name: "Remessas (atual)" }).getAttribute("href")).toBe("/tarefas?q=remessa&focalPoint=1001");
  view.unmount(); render(<SavedTaskFilters {...props} />);
  expect(screen.getByRole("link", { name: "Remessas (atual)" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Remover favorito Remessas" }));
  expect(screen.queryByRole("link")).toBeNull();
});
it("não compartilha favoritos entre perfis ou unidades", () => {
  localStorage.setItem(savedFiltersKey("bob", "unit"), JSON.stringify([{ name: "Bob", href: "/tarefas" }]));
  localStorage.setItem(savedFiltersKey("alice", "other"), JSON.stringify([{ name: "Outra unidade", href: "/tarefas" }]));
  render(<SavedTaskFilters {...props} />);
  expect(screen.queryByRole("link")).toBeNull();
});
it("informa nome duplicado sem sobrescrever e recupera falha de armazenamento", async () => {
  const user = userEvent.setup(); render(<SavedTaskFilters {...props} />);
  await user.type(screen.getByLabelText("Nome do favorito"), "Equipe");
  await user.click(screen.getByRole("button", { name: "Salvar consulta atual" }));
  await user.type(screen.getByLabelText("Nome do favorito"), "equipe");
  await user.click(screen.getByRole("button", { name: "Salvar consulta atual" }));
  expect(screen.getByRole("alert").textContent).toContain("Já existe");
  await user.clear(screen.getByLabelText("Nome do favorito")); await user.type(screen.getByLabelText("Nome do favorito"), "Outra");
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("quota", "QuotaExceededError"); });
  await user.click(screen.getByRole("button", { name: "Salvar consulta atual" }));
  expect(screen.getByRole("alert").textContent).toContain("armazenamento");
  expect(screen.getByLabelText("Nome do favorito")).toHaveProperty("value", "Outra");
  spy.mockRestore();
  await user.click(screen.getByRole("button", { name: "Salvar consulta atual" })); expect(screen.getAllByRole("link")).toHaveLength(2);
});
it("atualiza alterações de outra aba e ignora conteúdo corrompido", () => {
  render(<SavedTaskFilters {...props} />);
  localStorage.setItem(savedFiltersKey("alice", "unit"), JSON.stringify([{ name: "Nova", href: "/tarefas?status=PENDING" }]));
  fireEvent(window, new Event("storage"));
  expect(screen.getByRole("link", { name: "Nova" })).toBeTruthy();
  localStorage.setItem(savedFiltersKey("alice", "unit"), "corrompido"); fireEvent(window, new Event("storage"));
  expect(screen.queryByRole("link")).toBeNull();
});
it("impede salvar filtros inválidos", () => {
  render(<SavedTaskFilters {...props} filters={resolveTaskListParams({ from: "bad" })} />);
  expect(screen.getByRole("button", { name: "Salvar consulta atual" })).toHaveProperty("disabled", true);
});
