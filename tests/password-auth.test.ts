import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPasswordAuth } from "../src/lib/auth-config";
import { taskForm } from "./helpers/form-data";
import { provisionPassword } from "../src/lib/provision-user";

const context = vi.hoisted(() => ({ headers: new Headers(), database: null as unknown as PrismaClient, auth: null as unknown as ReturnType<typeof createPasswordAuth> }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers, cookies: async () => ({ get: () => ({ value: "manager" }) }) }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return context.database; } }));
vi.mock("@/lib/password-auth", () => ({ getPasswordAuth: () => context.auth, isPasswordAuthConfigured: () => true }));

const baseURL = "http://localhost:3000";
const password = "Senha-de-teste-2026!";
let directory: string;
let database: PrismaClient;
let auth: ReturnType<typeof createPasswordAuth>;
let currentUser: typeof import("../src/lib/auth").getCurrentUser;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "agenda-auth-tests-"));
  database = new PrismaClient({ datasources: { db: { url: `file:${join(directory, "auth.db")}` } } });
  context.database = database;
  for (const folder of (await readdir(resolve("prisma/migrations"))).sort()) {
    if (folder === "migration_lock.toml") continue;
    const sql = await readFile(resolve("prisma/migrations", folder, "migration.sql"), "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await database.$executeRawUnsafe(statement);
  }
  await database.unit.createMany({ data: [{ id: "unit", code: "U", name: "Unidade" }, { id: "other", code: "O", name: "Outra" }] });
  await database.user.createMany({ data: [
    { id: "actor", name: "Operador", email: "actor@test.invalid", role: "OPERATOR", unitId: "unit" },
    { id: "manager", name: "Gestor", email: "manager@test.invalid", role: "ADMIN", unitId: "unit" },
  ] });
  auth = createPasswordAuth(database, { secret: "segredo-exclusivo-dos-testes-com-mais-de-32-caracteres", baseURL });
  context.auth = auth;
  ({ getCurrentUser: currentUser } = await import("../src/lib/auth"));
});

beforeEach(async () => {
  context.headers = new Headers();
  vi.stubEnv("BETTER_AUTH_SECRET", "segredo-exclusivo-dos-testes-com-mais-de-32-caracteres");
  vi.stubEnv("DEMO_MODE", "true");
  await database.task.deleteMany();
  await database.authSession.deleteMany();
  await database.authRateLimit.deleteMany();
  await database.user.update({ where: { id: "actor" }, data: { role: "OPERATOR", unitId: "unit", isActive: true } });
  await provisionPassword(database, "actor@test.invalid", password);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await database?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

function request(path: string, body?: unknown, cookie?: string, origin = baseURL) {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST", headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}
async function login() {
  const response = await request("/sign-in/email", { email: "actor@test.invalid", password });
  expect(response.status).toBe(200);
  const cookies = response.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
  expect(cookies).toContain("session_token=");
  return { response, cookies };
}

describe("autenticação por senha", () => {
  it("login cria sessão verificada e recupera perfil/unidade do diretório", async () => {
    const { response, cookies } = await login();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    context.headers = new Headers({ cookie: cookies });
    expect(await currentUser()).toMatchObject({ id: "actor", role: "OPERATOR", unitId: "unit" });
    expect(await database.authSession.count()).toBe(1);
  });

  it("Server Actions aplicam perfil/unidade da sessão real e ignoram cookie de gestor forjado", async () => {
    const { cookies } = await login();
    context.headers = new Headers({ cookie: `${cookies}; userId=manager` });
    const actions = await import("../src/actions");
    expect((await actions.createTask({ message: "" }, taskForm())).success).toBe(true);
    const task = await database.task.findFirstOrThrow();
    expect(task).toMatchObject({ createdById: "actor", unitId: "unit" });
    expect((await actions.completeTask(task.id)).success).toBe(true);
    expect((await actions.validateTask(task.id)).success).toBe(false);
    expect((await actions.archiveTask(task.id, "Tentativa indevida")).success).toBe(false);
    await database.user.update({ where: { id: "actor" }, data: { role: "VIEWER" } });
    expect((await actions.createTask({ message: "" }, taskForm())).success).toBe(false);
    expect(await database.task.count()).toBe(1);
  });

  it("senha fica armazenada como hash e o provisionamento mantém perfil/unidade", async () => {
    const account = await database.authAccount.findFirstOrThrow();
    expect(account.password).not.toBe(password);
    expect(account.password!.length).toBeGreaterThan(64);
    expect(await database.user.findUniqueOrThrow({ where: { id: "actor" } })).toMatchObject({ role: "OPERATOR", unitId: "unit" });
  });

  it("senha incorreta e e-mail desconhecido têm a mesma resposta", async () => {
    const wrong = await request("/sign-in/email", { email: "actor@test.invalid", password: "senha-incorreta" });
    const unknown = await request("/sign-in/email", { email: "missing@test.invalid", password });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(await database.authSession.count()).toBe(0);
  });

  it("cookie antigo ou forjado não permite se passar pelo gestor", async () => {
    context.headers = new Headers({ cookie: "userId=manager; better-auth.session_token=forjado" });
    expect(await currentUser()).toBeNull();
    expect(await database.authSession.count()).toBe(0);
  });

  it("expiração invalida o acesso", async () => {
    const { cookies } = await login();
    await database.authSession.updateMany({ data: { expiresAt: new Date(2000, 0, 1) } });
    context.headers = new Headers({ cookie: cookies });
    expect(await currentUser()).toBeNull();
  });

  it("logout revoga a sessão, inclusive se o cookie anterior for reutilizado", async () => {
    const { cookies } = await login();
    expect((await request("/sign-out", {}, cookies)).status).toBe(200);
    expect(await database.authSession.count()).toBe(0);
    context.headers = new Headers({ cookie: cookies });
    expect(await currentUser()).toBeNull();
  });

  it("mudanças de perfil e unidade valem na requisição seguinte", async () => {
    const { cookies } = await login();
    await database.user.update({ where: { id: "actor" }, data: { role: "VIEWER", unitId: "other" } });
    context.headers = new Headers({ cookie: cookies });
    expect(await currentUser()).toMatchObject({ role: "VIEWER", unitId: "other" });
  });

  it("reprovisionar senha revoga sessões e permite somente a senha nova", async () => {
    const { cookies } = await login();
    await provisionPassword(database, "actor@test.invalid", "Senha-nova-mais-segura!");
    context.headers = new Headers({ cookie: cookies });
    expect(await currentUser()).toBeNull();
    expect((await request("/sign-in/email", { email: "actor@test.invalid", password })).status).toBe(401);
    expect((await request("/sign-in/email", { email: "actor@test.invalid", password: "Senha-nova-mais-segura!" })).status).toBe(200);
  });

  it("cadastro público fica fechado, inclusive para perfil ou unidade forjados", async () => {
    const response = await request("/sign-up/email", { email: "new@test.invalid", name: "Intruso", password, role: "ADMIN", unitId: "unit" });
    expect(response.ok).toBe(false);
    expect(await database.authUser.count()).toBe(1);
    expect(await database.user.count()).toBe(2);
  });

  it("origem externa é recusada", async () => {
    const response = await request("/sign-in/email", { email: "actor@test.invalid", password }, undefined, "https://evil.invalid");
    expect(response.status).toBe(403);
    expect(await database.authSession.count()).toBe(0);
  });

  it("limita tentativas de senha pelo handler HTTP", async () => {
    let lastResponse: Response | undefined;
    for (let index = 0; index < 11; index++) lastResponse = await request("/sign-in/email", { email: "actor@test.invalid", password: "senha-incorreta" });
    expect(lastResponse!.status).toBe(429);
    expect(await database.authRateLimit.count()).toBeGreaterThan(0);
    expect(await database.authSession.count()).toBe(0);
  });

  it("origem HTTPS gera cookie Secure", async () => {
    const httpsAuth = createPasswordAuth(database, { secret: "segredo-separado-dos-testes-seguros-com-mais-de-32-caracteres", baseURL: "https://agenda.example.com" });
    const response = await httpsAuth.handler(new Request("https://agenda.example.com/api/auth/sign-in/email", {
      method: "POST", headers: { origin: "https://agenda.example.com", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "actor@test.invalid", password }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/; Secure/i);
  });

  it("não provisiona usuário desconhecido nem senha curta", async () => {
    await expect(provisionPassword(database, "missing@test.invalid", password)).rejects.toThrow("Usuário não encontrado");
    await expect(provisionPassword(database, "actor@test.invalid", "curta")).rejects.toThrow();
    expect(await database.authUser.count()).toBe(1);
  });
});


describe("contas desativadas no login real", () => {
  it("não cria sessão para conta desativada e permite novo login após reativação", async () => {
    await database.user.update({ where: { id: "actor" }, data: { isActive: false } });
    const response = await request("/sign-in/email", { email: "actor@test.invalid", password });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie") || "").not.toContain("session_token=");
    expect(await database.authSession.count()).toBe(0);
    await database.user.update({ where: { id: "actor" }, data: { isActive: true } });
    await login();
  });
  it("recusa sessão existente se a conta estiver desativada mesmo sem apagar o cookie", async () => {
    const { cookies } = await login();
    context.headers = new Headers({ cookie: cookies });
    expect(await currentUser()).not.toBeNull();
    await database.user.update({ where: { id: "actor" }, data: { isActive: false } });
    expect(await currentUser()).toBeNull();
    const actions = await import("../src/actions");
    expect((await actions.createTask({ message: "" }, taskForm())).success).toBe(false);
  });
});
