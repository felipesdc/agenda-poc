// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TaskChecklist from "../src/components/TaskChecklist";
const api = vi.hoisted(() => ({ getChecklist: vi.fn(), changeChecklist: vi.fn() }));
vi.mock("@/actions/checklist", () => api);
beforeEach(() => { vi.resetAllMocks(); api.getChecklist.mockResolvedValue({ success: true, items: [{ id: "step", title: "Revisar", done: false }] }); api.changeChecklist.mockResolvedValue({ success: true, message: "Atualizado" }); });
afterEach(cleanup);
it("carrega sob demanda, exibe progresso e permite marcar e adicionar etapas", async () => {
  const user = userEvent.setup(); render(<TaskChecklist taskId="task" editable />); expect(api.getChecklist).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Ver etapas" })); await screen.findByText("0 de 1 etapas concluídas");
  await user.click(screen.getByRole("checkbox", { name: "Revisar" })); expect(api.changeChecklist).toHaveBeenCalledWith("task", { operation: "toggle", id: "step", done: true });
  await user.type(screen.getByLabelText("Nova etapa"), "Conferir"); await user.click(screen.getByRole("button", { name: "Adicionar etapa" }));
  expect(api.changeChecklist).toHaveBeenCalledWith("task", { operation: "add", title: "Conferir" });
});
it("preserva rascunho após falha e impede edição em leitura", async () => {
  api.changeChecklist.mockResolvedValue({ success: false, message: "Erro ao salvar" });
  const user = userEvent.setup(); const view = render(<TaskChecklist taskId="task" editable />); await user.click(screen.getByRole("button", { name: "Ver etapas" })); await screen.findByText("Revisar");
  await user.type(screen.getByLabelText("Nova etapa"), "Rascunho"); await user.click(screen.getByRole("button", { name: "Adicionar etapa" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Erro ao salvar"); expect(screen.getByLabelText("Nova etapa")).toHaveProperty("value", "Rascunho");
  view.unmount(); render(<TaskChecklist taskId="task" editable={false} />); await user.click(screen.getByRole("button", { name: "Ver etapas" })); await screen.findByText("Revisar");
  expect(screen.getByRole("checkbox", { name: "Revisar" })).toHaveProperty("disabled", true); expect(screen.queryByLabelText("Nova etapa")).toBeNull();
});
