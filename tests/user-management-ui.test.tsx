// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserManagement from "../src/components/UserManagement";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), activate: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/user-actions", () => ({ createManagedUser: mocks.create, updateManagedUser: mocks.update, setManagedUserActive: mocks.activate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });
const users = [{ id: "admin", name: "Gestora", email: "admin@test.invalid", role: "ADMIN" as const, hasPassword: true, isActive: true }];
describe("gestão de usuários", () => {
  it("mostra situação da senha e impede escolha de perfil inferior para si", () => {
    render(<UserManagement users={users} actorId="admin" />);
    expect(screen.getByText("Senha cadastrada")).toBeTruthy();
    const form = within(screen.getByRole("form", { name: "Editar Gestora" }));
    expect((form.getByRole("option", { name: "Visualizador" }) as HTMLOptionElement).disabled).toBe(true);
  });
  it("preserva campos em erro e permite repetir o cadastro", async () => {
    mocks.create.mockResolvedValueOnce({ success: false, message: "Falha ao cadastrar" }).mockResolvedValueOnce({ success: true, message: "Salvo" });
    const user = userEvent.setup();
    render(<UserManagement users={[]} actorId="admin" />);
    await user.type(screen.getByLabelText("Nome"), "Nova Pessoa");
    await user.type(screen.getByLabelText("E-mail"), "nova@test.invalid");
    await user.click(screen.getByRole("button", { name: "Cadastrar usuário" }));
    expect(screen.getByRole("alert").textContent).toBe("Falha ao cadastrar");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Nova Pessoa");
    await user.click(screen.getByRole("button", { name: "Cadastrar usuário" }));
    expect(screen.getByRole("status").textContent).toBe("Salvo");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("edita usuário existente e trata falha de conexão", async () => {
    mocks.update.mockRejectedValueOnce(new Error("network"));
    const user = userEvent.setup();
    render(<UserManagement users={users} actorId="admin" />);
    const form = within(screen.getByRole("form", { name: "Editar Gestora" }));
    await user.click(form.getByRole("button", { name: "Salvar alterações" }));
    expect(form.getByRole("alert").textContent).toContain("Não foi possível conectar");
    expect(mocks.update.mock.calls[0][0]).toBe("admin");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});


describe("situação da conta", () => {
  const account = { id: "operator", name: "Pessoa", email: "pessoa@test.invalid", role: "OPERATOR" as const, hasPassword: true, isActive: true };
  it("não oferece desativar a própria conta", () => {
    render(<UserManagement users={users} actorId="admin" />);
    expect(screen.queryByRole("button", { name: "Desativar conta" })).toBeNull();
  });
  it("pede confirmação, permite cancelar e desativa somente após confirmar", async () => {
    mocks.activate.mockResolvedValue({ success: true, message: "Salvo" });
    const user = userEvent.setup();
    render(<UserManagement users={[account]} actorId="admin" />);
    await user.click(screen.getByRole("button", { name: "Desativar conta" }));
    expect(mocks.activate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.activate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Desativar conta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(mocks.activate).toHaveBeenCalledWith("operator", false);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("reativa e permite tentar novamente após falha", async () => {
    mocks.activate.mockResolvedValueOnce({ success: false, message: "Falha" }).mockResolvedValueOnce({ success: true, message: "Salvo" });
    const user = userEvent.setup();
    render(<UserManagement users={[{ ...account, isActive: false }]} actorId="admin" />);
    expect(screen.getByText("Pessoa · Desativado")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reativar conta" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByRole("alert").textContent).toBe("Falha");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(mocks.activate).toHaveBeenCalledWith("operator", true);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
