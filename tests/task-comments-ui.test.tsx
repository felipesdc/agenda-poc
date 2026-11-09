// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TaskComments from "../src/components/TaskComments";
import type { CommentPage } from "../src/actions/task-comments";
const api = vi.hoisted(() => ({ getTaskComments: vi.fn(), addTaskComment: vi.fn() }));
vi.mock("../src/actions/task-comments", () => api);
const empty: CommentPage = { success: true, message: "", comments: [], total: 0, page: 1, pages: 1 };
beforeEach(() => { vi.resetAllMocks(); api.getTaskComments.mockResolvedValue(empty); api.addTaskComment.mockResolvedValue({ success: true, message: "Comentário publicado." }); });
afterEach(cleanup);
async function open(canComment = true) { const user = userEvent.setup(); render(<TaskComments taskId="task" canComment={canComment} />); await user.click(screen.getByRole("button", { name: "Ver comentários" })); await screen.findByText("Nenhum comentário publicado."); return user; }
it("carrega somente ao abrir e mostra texto seguro, autor e data", async () => {
  api.getTaskComments.mockResolvedValue({ ...empty, total: 1, comments: [{ id: "1", body: "<img src=x onerror=alert(1)>", authorName: "Alice", createdAt: new Date("2026-11-09T12:00:00Z") }] });
  const user = userEvent.setup(); render(<TaskComments taskId="task" canComment />);
  expect(api.getTaskComments).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Ver comentários" }));
  expect(await screen.findByText("Alice")).toBeTruthy(); expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy(); expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("09/11/2026 às 09:00")).toBeTruthy();
});
it("publica, limpa somente no sucesso e atualiza a consulta", async () => {
  const user = await open();
  await user.type(screen.getByLabelText("Comentário"), "Revisado");
  api.getTaskComments.mockResolvedValue({ ...empty, total: 1, comments: [{ id: "1", body: "Revisado", authorName: "Alice", createdAt: new Date() }] });
  await user.click(screen.getByRole("button", { name: "Publicar comentário" }));
  expect(await screen.findByText("Comentário publicado.")).toBeTruthy();
  expect(api.addTaskComment).toHaveBeenCalledWith("task", "Revisado"); expect(screen.getByLabelText("Comentário")).toHaveProperty("value", "");
  expect(await screen.findByText("Revisado")).toBeTruthy();
});
it("mantém rascunho na falha e bloqueia envios duplicados durante publicação", async () => {
  const user = await open(); await user.type(screen.getByLabelText("Comentário"), "Rascunho");
  let finish!: (value: { success: boolean; message: string }) => void;
  api.addTaskComment.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await user.click(screen.getByRole("button", { name: "Publicar comentário" }));
  expect(screen.getByRole("button", { name: "Publicando..." })).toHaveProperty("disabled", true);
  await act(async () => finish({ success: false, message: "Tente novamente" }));
  expect(screen.getByRole("alert").textContent).toBe("Tente novamente"); expect(screen.getByLabelText("Comentário")).toHaveProperty("value", "Rascunho");
  await user.click(screen.getByRole("button", { name: "Publicar comentário" })); expect(await screen.findByText("Comentário publicado.")).toBeTruthy();
});
it("leitor consulta sem formulário e recupera falha no carregamento", async () => {
  api.getTaskComments.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup(); render(<TaskComments taskId="task" canComment={false} />);
  await user.click(screen.getByRole("button", { name: "Ver comentários" }));
  await screen.findByRole("alert"); expect(screen.queryByRole("textbox")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Tentar novamente" })); expect(await screen.findByText("Nenhum comentário publicado.")).toBeTruthy();
});
it("navega para comentários antigos e preserva rascunho ao recolher", async () => {
  api.getTaskComments.mockResolvedValue({ ...empty, total: 21, pages: 2 });
  const user = userEvent.setup(); render(<TaskComments taskId="task" canComment />);
  await user.click(screen.getByRole("button", { name: "Ver comentários" })); await screen.findByText("Página 1 de 2");
  fireEvent.change(screen.getByLabelText("Comentário"), { target: { value: "Ainda escrevendo" } });
  api.getTaskComments.mockResolvedValue({ ...empty, page: 2, pages: 2, total: 21 });
  await user.click(screen.getByRole("button", { name: "Mais antigos" }));
  await waitFor(() => expect(api.getTaskComments).toHaveBeenLastCalledWith("task", 2)); await screen.findByText("Página 2 de 2");
  await user.click(screen.getByRole("button", { name: "Ocultar comentários" }));
  await user.click(screen.getByRole("button", { name: "Ver comentários" })); expect(screen.getByLabelText("Comentário")).toHaveProperty("value", "Ainda escrevendo");
});
