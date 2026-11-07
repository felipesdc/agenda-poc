import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPasswordAuthConfigured, getPasswordAuth } from "../src/lib/password-auth";
import { GET } from "../src/app/api/auth/[...all]/route";

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "segredo-de-configuracao-com-mais-de-32-caracteres");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});
afterEach(() => vi.unstubAllEnvs());
describe("configuração da autenticação", () => {
  it("permite HTTP local fora de produção", () => expect(isPasswordAuthConfigured()).toBe(true));
  it.each(["", "curto"])("não habilita login sem segredo adequado", (secret) => {
    vi.stubEnv("BETTER_AUTH_SECRET", secret);
    expect(isPasswordAuthConfigured()).toBe(false);
    expect(() => getPasswordAuth()).toThrow("BETTER_AUTH_SECRET");
  });
  it.each(["", "invalida", "ftp://host", "http://user:password@host"])("recusa URL inválida (%s)", (url) => {
    vi.stubEnv("BETTER_AUTH_URL", url);
    expect(isPasswordAuthConfigured()).toBe(false);
  });
  it("produção exige HTTPS", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isPasswordAuthConfigured()).toBe(false);
    vi.stubEnv("BETTER_AUTH_URL", "https://agenda.example.com");
    expect(isPasswordAuthConfigured()).toBe(true);
  });
  it("API sem configuração retorna indisponibilidade sem segredo na resposta", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const response = await GET(new Request("http://localhost:3000/api/auth/get-session"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "Login indisponível. Contate o administrador." });
  });
});
