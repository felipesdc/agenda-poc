// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FocalReplacementForm from "../src/components/FocalReplacementForm";
const mocks = vi.hoisted(() => ({ previewFocalReplacement: vi.fn(), applyFocalReplacement: vi.fn(), refresh: vi.fn() }));
vi.mock("@/actions/focal-replacement", () => mocks);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
const sources = [{ id: 1001, name: "Alice" }]; const destinations = [...sources, { id: 1002, name: "Bob" }];
const preview = { source: sources[0], destination: destinations[1], total: 201, digest: "a".repeat(64), from: new Date("2026-11-10T03:00:00Z").toISOString(), tasks: [{ id: "t1", title: "Remessa", dueDate: new Date("2026-11-12T12:00:00Z"), focalPoints: sources }] };
beforeEach(() => { vi.resetAllMocks(); mocks.previewFocalReplacement.mockResolvedValue({ success: true, message: "Prévia atualizada.", preview }); mocks.applyFocalReplacement.mockResolvedValue({ success: true, message: "1 tarefa(s) atualizada(s).", count: 1, remaining: 200 }); });
afterEach(cleanup);
async function fill() { const user = userEvent.setup(); render(<FocalReplacementForm sources={sources} destinations={destinations} />); await user.selectOptions(screen.getByLabelText("Ponto focal atual"), "1001"); await user.selectOptions(screen.getByLabelText("Novo ponto focal"), "1002"); return user; }
it("exibe as tarefas afetadas antes de confirmar e orienta continuar lotes", async () => {
  const user = await fill(); expect(mocks.applyFocalReplacement).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Ver tarefas afetadas" })); expect(await screen.findByRole("heading", { name: "Prévia da substituição" })).toBeTruthy();
  expect(screen.getByText("Remessa")).toBeTruthy(); expect(screen.getByRole("status").textContent).toContain("primeiras 1");
  await user.click(screen.getByRole("button", { name: "Confirmar substituição em 1 tarefa(s)" }));
  expect(mocks.applyFocalReplacement).toHaveBeenCalledWith(1001, 1002, preview.digest);
  expect((await screen.findByRole("status")).textContent).toContain("Restam 200"); expect(mocks.refresh).toHaveBeenCalled();
});
it("invalida prévia ao mudar pessoa e exige pessoas distintas", async () => {
  const user = await fill(); await user.click(screen.getByRole("button", { name: "Ver tarefas afetadas" })); await screen.findByText("Remessa");
  await user.selectOptions(screen.getByLabelText("Novo ponto focal"), "1001"); expect(screen.queryByText("Remessa")).toBeNull();
  expect(screen.getByRole("button", { name: "Ver tarefas afetadas" })).toHaveProperty("disabled", true); expect(screen.getByText("Escolha pessoas diferentes.")).toBeTruthy();
});
it("explica alteração concorrente e exige nova prévia", async () => {
  mocks.applyFocalReplacement.mockResolvedValue({ success: false, message: "As tarefas mudaram. Consulte novamente." });
  const user = await fill(); await user.click(screen.getByRole("button", { name: "Ver tarefas afetadas" })); await screen.findByText("Remessa");
  await user.click(screen.getByRole("button", { name: "Confirmar substituição em 1 tarefa(s)" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Consulte novamente"); expect(screen.queryByText("Remessa")).toBeNull();
});
it("não oferece confirmação quando a consulta está vazia", async () => {
  mocks.previewFocalReplacement.mockResolvedValue({ success: true, preview: { ...preview, total: 0, tasks: [] } });
  const user = await fill(); await user.click(screen.getByRole("button", { name: "Ver tarefas afetadas" }));
  expect(await screen.findByText("Nenhuma tarefa pendente futura encontrada para essa pessoa.")).toBeTruthy(); expect(screen.queryByRole("button", { name: /Confirmar substituição/ })).toBeNull();
});
