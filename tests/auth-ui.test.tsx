// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "../src/components/LoginForm";
import LogoutButton from "../src/components/LogoutButton";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function fillLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "Actor@Test.invalid");
  await user.type(screen.getByLabelText("Senha"), "Senha-de-teste-2026!");
  return user;
}

describe("formulário de login", () => {
  it("envia credenciais à API e só redireciona após sucesso", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    render(<LoginForm />);
    const user = await fillLogin();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in/email", expect.objectContaining({ method: "POST", credentials: "same-origin", body: JSON.stringify({ email: "actor@test.invalid", password: "Senha-de-teste-2026!", rememberMe: false }) }));
    expect(screen.getByLabelText("Senha")).toHaveProperty("value", "");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
  it.each([[401, "E-mail ou senha inválidos."], [429, "Muitas tentativas."], [503, "Login indisponível."]])("falha HTTP %s é informada sem expor a resposta do servidor", async (status, text) => {
    fetchMock.mockResolvedValue(new Response("dados internos que não devem aparecer", { status: Number(status) }));
    render(<LoginForm />);
    const user = await fillLogin();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toContain(String(text));
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("E-mail")).toHaveProperty("value", "Actor@Test.invalid");
  });
  it("erro de conexão permite nova tentativa", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Response("{}"));
    render(<LoginForm />);
    const user = await fillLogin();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
  it("não envia sem campos obrigatórios e bloqueia envios simultâneos", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<LoginForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await fillLogin();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("button", { name: "Entrando..." })).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("button", { name: "Entrando..." }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => finish(new Response("{}")));
  });
});

describe("logout", () => {
  it("encerra sessão na API antes de voltar ao login", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    render(<LogoutButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-out", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
  });
  it("não anuncia saída quando a API falha", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<LogoutButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível encerrar");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
