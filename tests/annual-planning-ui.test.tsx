// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AnnualPlanningForm from "../src/components/AnnualPlanningForm";
const mocks = vi.hoisted(() => ({ createAnnualPlan: vi.fn() }));
vi.mock("@/actions/annual-planning", () => mocks);
const task = { id: "a", title: "Relatório anual", description: "Descrição original", dueDate: new Date("2025-11-01T12:00:00Z"), completedAt: new Date("2025-12-01T12:00:00Z"), frequency: "ANNUAL" as const, status: "VALIDATED", archivedAt: null, focalPoints: [{ id: 1001, name: "Alice" }], authorName: "Bob", previouslyPlanned: true, recurrenceInTargetYear: true };
const props = { tasks: [task], sourceYear: 2025, targetYear: 2026, author: "bob", canCreate: true, restartHref: "/planejamento-anual?sourceYear=2025&targetYear=2026" };
beforeEach(() => { vi.clearAllMocks(); mocks.createAnnualPlan.mockResolvedValue({ success: true, message: "1 tarefa(s) criada(s) com sucesso." }); });
afterEach(cleanup);
it("exige seleção e prazo, apresenta avisos e cria cópia revisada", async () => {
  const user = userEvent.setup(); render(<AnnualPlanningForm {...props} />);
  expect(screen.getByText(/Já existe uma cópia criada/).textContent).toContain("recorrência");
  expect(screen.getByRole("button", { name: "Criar 0 tarefa(s) em 2026" })).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("checkbox", { name: /Relatório anual/ }));
  const date = screen.getByLabelText("Novo prazo para Relatório anual"); expect(date).toHaveProperty("required", true);
  await user.type(date, "2026-05-10"); await user.click(screen.getByRole("button", { name: "Criar 1 tarefa(s) em 2026" }));
  expect((await screen.findByRole("status")).textContent).toContain("criada");
  expect(mocks.createAnnualPlan).toHaveBeenCalledWith(expect.objectContaining({ sourceYear: 2025, targetYear: 2026, author: "bob", items: [{ id: "a", dueDate: "2026-05-10" }] }));
  expect(screen.getByRole("link", { name: "Planejar outro lote" }).getAttribute("href")).toBe(props.restartHref);
});
it("retenta com a mesma chave e dados após falha de transporte", async () => {
  mocks.createAnnualPlan.mockRejectedValueOnce(new Error("offline")); const user = userEvent.setup(); render(<AnnualPlanningForm {...props} />);
  await user.click(screen.getByRole("checkbox", { name: /Relatório anual/ })); await user.type(screen.getByLabelText("Novo prazo para Relatório anual"), "2026-05-10");
  await user.click(screen.getByRole("button", { name: "Criar 1 tarefa(s) em 2026" })); expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByLabelText("Novo prazo para Relatório anual")).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("button", { name: "Tentar novamente" })); await screen.findByRole("status");
  expect(mocks.createAnnualPlan.mock.calls[1][0]).toEqual(mocks.createAnnualPlan.mock.calls[0][0]);
});
it("visualizador pode consultar mas não selecionar nem criar", () => {
  render(<AnnualPlanningForm {...props} canCreate={false} />); expect(screen.getByRole("checkbox", { name: /Relatório anual/ })).toHaveProperty("disabled", true); expect(screen.queryByRole("button", { name: /Criar/ })).toBeNull();
});
