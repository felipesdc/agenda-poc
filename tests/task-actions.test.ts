import { migrationStatements } from "./helpers/migrations";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { taskForm } from "./helpers/form-data";

// Só as fronteiras do Next são simuladas. Consultas, relações e auditoria usam SQLite real.
const context = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  revalidate: vi.fn(),
  setCookie: vi.fn(),
  clients: [] as { $disconnect(): Promise<void> }[],
}));
vi.mock("next/cache", () => ({ revalidatePath: context.revalidate }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => context.cookies.has(name) ? { value: context.cookies.get(name)! } : undefined,
    set: (name: string, value: string, options: unknown) => {
      context.cookies.set(name, value);
      context.setCookie(name, value, options);
    },
  }),
}));
// Rastreia os clientes reais apenas para fechar também a conexão privada da auditoria.
vi.mock("@prisma/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...original,
    PrismaClient: class extends original.PrismaClient {
      constructor(options?: Prisma.PrismaClientOptions) {
        super(options);
        context.clients.push(this);
      }
    },
  };
});

let directory: string;
let prisma: PrismaClient;
let actions: typeof import("../src/actions");
let getCurrentUser: typeof import("../src/lib/auth").getCurrentUser;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDemoMode = process.env.DEMO_MODE;
const originalAuthSecret = process.env.BETTER_AUTH_SECRET;
const previous = { message: "" };

beforeAll(async () => {
  process.env.DEMO_MODE = "true";
  delete process.env.BETTER_AUTH_SECRET;
  directory = await mkdtemp(join(tmpdir(), "agenda-poc-tests-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  // Importar só após escolher a base temporária evita qualquer acesso ao dev.db.
  prisma = (await import("../src/lib/prisma")).prisma;
  const migrations = resolve("prisma/migrations");
  for (const folder of (await readdir(migrations)).sort()) {
    if (folder === "migration_lock.toml") continue;
    const sql = await readFile(join(migrations, folder, "migration.sql"), "utf8");
    // Triggers usam marcadores explícitos para preservar o corpo da instrução.
    for (const statement of migrationStatements(sql)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
  await prisma.unit.createMany({ data: [
    { id: "unit-test", code: "TEST", name: "Unidade teste" },
    { id: "unit-other", code: "OTHER", name: "Outra unidade" },
  ] });
  await prisma.user.createMany({ data: [
    { id: "operator-test", name: "Operador", email: "operator@test.invalid", role: "OPERATOR", unitId: "unit-test" },
    { id: "admin-test", name: "Gestora", email: "admin@test.invalid", role: "ADMIN", unitId: "unit-test" },
    { id: "viewer-test", name: "Leitor", email: "viewer@test.invalid", role: "VIEWER", unitId: "unit-test" },
    { id: "other-admin", name: "Gestor externo", email: "other@test.invalid", role: "ADMIN", unitId: "unit-other" },
  ] });
  await prisma.employee.createMany({ data: [
    { id: 1001, name: "Ponto focal A", email: "a@test.invalid" },
    { id: 1002, name: "Ponto focal B", email: "b@test.invalid" },
  ] });
  actions = await import("../src/actions");
  ({ getCurrentUser } = await import("../src/lib/auth"));
});

beforeEach(async () => {
  await prisma.task.deleteMany();
  context.cookies.clear();
  context.cookies.set("userId", "operator-test");
});

afterAll(async () => {
  await Promise.all(context.clients.map((client) => client.$disconnect()));
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemoMode;
  if (originalAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = originalAuthSecret;
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function create(overrides: Record<string, string | string[]> = {}) {
  const result = await actions.createTask(previous, taskForm(overrides));
  expect(result.success).toBe(true);
  return prisma.task.findFirstOrThrow({ include: { focalPoints: true, history: true } });
}

describe("cadastro e edição", () => {
  it("persiste padrão NONE, prazo, criador, unidade e histórico", async () => {
    const task = await create({ title: "  Enviar remessa  ", focalPoints: ["1001", "1001", "1002"] });
    expect(task).toMatchObject({ title: "Enviar remessa", status: "PENDING", frequency: "NONE", createdById: "operator-test", unitId: "unit-test" });
    expect(task.dueDate.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(task.focalPoints.map((employee) => employee.id).sort()).toEqual([1001, 1002]);
    expect(task.history).toEqual([expect.objectContaining({ action: "CREATE", userId: "operator-test", detail: "Tarefa criada" })]);
    expect(context.revalidate).toHaveBeenCalledWith("/");
  });

  it("recusa campos inválidos e funcionário inexistente sem criar tarefas", async () => {
    const invalid = await actions.createTask(previous, taskForm({ dueDate: "2026-02-30" }));
    expect(invalid.success).toBe(false);
    expect(invalid.errors?.dueDate).toHaveLength(1);
    const unknown = await actions.createTask(previous, taskForm({ focalPoints: ["99999"] }));
    expect(unknown.success).toBe(false);
    expect(unknown.errors?.focalPoints).toHaveLength(1);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.taskHistory.count()).toBe(0);
    expect(context.revalidate).not.toHaveBeenCalled();
  });

  it("atualiza dados e substitui vínculos, auditando alterações", async () => {
    const task = await create({ focalPoints: ["1001"] });
    const result = await actions.updateTask(task.id, previous, taskForm({ title: "Remessa revisada", dueDate: "2026-12-10", description: "Novos detalhes", frequency: "MONTHLY", focalPoints: ["1002"] }));
    expect(result.success).toBe(true);
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { focalPoints: true, history: true } });
    expect(updated).toMatchObject({ title: "Remessa revisada", description: "Novos detalhes", frequency: "MONTHLY" });
    expect(updated.dueDate.toISOString()).toBe("2026-12-10T12:00:00.000Z");
    expect(updated.focalPoints.map((employee) => employee.id)).toEqual([1002]);
    expect(updated.history.filter((item) => item.action === "UPDATE").map((item) => item.detail)).toEqual(expect.arrayContaining([
      expect.stringContaining('Título: "Enviar remessa" → "Remessa revisada"'),
      expect.stringContaining("Prazo:"), expect.stringContaining("Periodicidade:"),
      expect.stringContaining("Descrição:"), expect.stringContaining("Pontos focais:"),
    ]));
  });

  it("permite remover todos os pontos focais", async () => {
    const task = await create({ focalPoints: ["1001", "1002"] });
    expect((await actions.updateTask(task.id, previous, taskForm())).success).toBe(true);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } }).focalPoints()).toEqual([]);
  });

  it("recusa edição inválida sem alterar dados, vínculos ou histórico", async () => {
    const task = await create({ focalPoints: ["1001"] });
    for (const data of [taskForm({ title: "  " }), taskForm({ focalPoints: ["99999"] })]) {
      expect((await actions.updateTask(task.id, previous, data)).success).toBe(false);
    }
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { focalPoints: true, history: true } })).toEqual(task);
  });


  it("retorna erro para tarefa não encontrada", async () => {
    expect(await actions.updateTask("missing", previous, taskForm())).toMatchObject({ success: false, message: "Tarefa não encontrada" });
    expect(await prisma.task.count()).toBe(0);
  });
});

describe("ciclo de vida e recorrência", () => {
  it("conclui pendência, grava data e auditoria do operador", async () => {
    const task = await create();
    const start = Date.now();
    expect((await actions.completeTask(task.id)).success).toBe(true);
    const completed = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { history: true } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt!.getTime()).toBeGreaterThanOrEqual(start);
    expect(completed.validatedAt).toBeNull();
    expect(completed.history).toContainEqual(expect.objectContaining({ action: "COMPLETE", userId: "operator-test" }));
  });

  it("impede operador de validar sem modificar tarefa nem criar sucessora", async () => {
    const task = await create({ frequency: "MONTHLY" });
    await actions.completeTask(task.id);
    expect((await actions.validateTask(task.id)).success).toBe(false);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
    expect(await prisma.task.count()).toBe(1);
    expect(await prisma.taskHistory.count({ where: { action: "VALIDATE" } })).toBe(0);
  });

  it.each(["NONE", "EVENTUAL"])("gestor valida %s sem gerar sucessora", async (frequency) => {
    const task = await create({ frequency });
    await actions.completeTask(task.id);
    context.cookies.set("userId", "admin-test");
    const start = Date.now();
    expect((await actions.validateTask(task.id)).success).toBe(true);
    const validated = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { history: true } });
    expect(validated.status).toBe("VALIDATED");
    expect(validated.validatedAt!.getTime()).toBeGreaterThanOrEqual(start);
    expect(validated.completedAt).not.toBeNull();
    expect(validated.history).toContainEqual(expect.objectContaining({ action: "VALIDATE", userId: "admin-test" }));
    expect(await prisma.task.count()).toBe(1);
  });

  it("validação de tarefa mensal gera pendência a partir do prazo original", async () => {
    const task = await create({ frequency: "MONTHLY", description: "Detalhes da rotina" });
    await actions.completeTask(task.id);
    context.cookies.set("userId", "admin-test");
    expect((await actions.validateTask(task.id)).success).toBe(true);
    const next = await prisma.task.findFirstOrThrow({ where: { id: { not: task.id } }, include: { history: true } });
    expect(await prisma.task.count()).toBe(2);
    expect(next).toMatchObject({ title: task.title, description: task.description, frequency: "MONTHLY", status: "PENDING", unitId: task.unitId, createdById: "admin-test", completedAt: null, validatedAt: null });
    expect(next.dueDate.toISOString()).toBe("2026-12-05T12:00:00.000Z");
    expect(next.history).toContainEqual(expect.objectContaining({ action: "CREATE", detail: expect.stringContaining("Recorrência") }));
  });

  it("retorna falha ao concluir ou validar tarefa inexistente", async () => {
    expect((await actions.completeTask("missing")).success).toBe(false);
    context.cookies.set("userId", "admin-test");
    expect((await actions.validateTask("missing")).success).toBe(false);
    expect(await prisma.taskHistory.count()).toBe(0);
  });
});

describe("arquivamento", () => {
  it("preserva tarefa, vínculos e histórico e registra motivo, autor e data", async () => {
    const task = await create({ focalPoints: ["1001"] });
    context.cookies.set("userId", "admin-test");
    const start = Date.now();
    expect((await actions.archiveTask(task.id, "  Rotina encerrada  ")).success).toBe(true);
    const archived = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { focalPoints: true, history: true } });
    expect(archived).toMatchObject({ status: task.status, dueDate: task.dueDate, archiveReason: "Rotina encerrada", archivedById: "admin-test", focalPoints: task.focalPoints });
    expect(archived.archivedAt!.getTime()).toBeGreaterThanOrEqual(start);
    expect(archived.history).toContainEqual(expect.objectContaining({ action: "ARCHIVE", userId: "admin-test", detail: "Motivo: Rotina encerrada" }));
    expect(archived.history).toContainEqual(task.history[0]);
    expect(await prisma.task.count()).toBe(1);
    expect((await actions.archiveTask(task.id, "Novo motivo")).success).toBe(false);
    expect(await prisma.taskHistory.count({ where: { action: "ARCHIVE" } })).toBe(1);
  });
});

describe("sessão de demonstração", () => {
  it.each([undefined, "missing"])("sessão ausente/inválida (%s) bloqueia todas as mutações", async (userId) => {
    const task = await create();
    context.cookies.clear();
    if (userId) context.cookies.set("userId", userId);
    for (const result of [
      await actions.createTask(previous, taskForm()),
      await actions.updateTask(task.id, previous, taskForm()),
      await actions.archiveTask(task.id, "Rotina encerrada"),
      await actions.completeTask(task.id),
      await actions.validateTask(task.id),
    ]) expect(result).toMatchObject({ success: false, message: "Você precisa estar logado." });
    expect(await prisma.task.count()).toBe(1);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("PENDING");
    expect(await getCurrentUser()).toBeNull();
  });

  it("troca de perfil grava cookie e identifica usuário", async () => {
    await actions.switchUser("admin@test.invalid");
    expect(context.setCookie).toHaveBeenCalledWith("userId", "admin-test", { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
    expect(await getCurrentUser()).toMatchObject({ id: "admin-test", role: "ADMIN" });
    expect(context.revalidate).toHaveBeenCalledWith("/");
  });


  it("e-mail desconhecido não modifica a sessão", async () => {
    await actions.switchUser("missing@test.invalid");
    expect(context.setCookie).not.toHaveBeenCalled();
    expect((await getCurrentUser())?.id).toBe("operator-test");
  });
});


describe("permissões por perfil e unidade", () => {
  it("VIEWER lê a própria unidade, mas não pode modificar tarefas", async () => {
    const task = await create();
    context.cookies.set("userId", "viewer-test");
    const { getAgendaData } = await import("../src/lib/tasks");
    const agenda = await getAgendaData(new Date(2026, 10, 1), new Date(2026, 10, 30, 23));
    expect(agenda.tasks.map((item) => item.id)).toEqual([task.id]);
    expect(agenda.employees).toEqual([]);
    for (const result of [
      await actions.createTask(previous, taskForm()), await actions.updateTask(task.id, previous, taskForm()),
      await actions.completeTask(task.id), await actions.validateTask(task.id), await actions.archiveTask(task.id, "Rotina encerrada"),
    ]) expect(result.success).toBe(false);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { focalPoints: true, history: true } })).toEqual(task);
    expect(await prisma.task.count()).toBe(1);
  });

  it("ignora tentativas do formulário de escolher unidade, criador e estado", async () => {
    const task = await create({ unitId: "unit-other", createdById: "other-admin", status: "VALIDATED", sourceTaskId: "forged" });
    expect(task).toMatchObject({ unitId: "unit-test", createdById: "operator-test", status: "PENDING", sourceTaskId: null });
  });

  it("operador não pode arquivar", async () => {
    const task = await create();
    expect((await actions.archiveTask(task.id, "Rotina encerrada")).success).toBe(false);
    expect(await prisma.task.count()).toBe(1);
  });

  it("gestor de outra unidade não lê nem modifica a tarefa por ID", async () => {
    const task = await create({ focalPoints: ["1001"] });
    context.cookies.set("userId", "other-admin");
    const { getAgendaData } = await import("../src/lib/tasks");
    expect((await getAgendaData(new Date(2026, 10, 1), new Date(2026, 10, 30, 23))).tasks).toEqual([]);
    for (const result of [
      await actions.updateTask(task.id, previous, taskForm({ title: "Ataque" })),
      await actions.completeTask(task.id), await actions.validateTask(task.id), await actions.archiveTask(task.id, "Rotina encerrada"),
    ]) expect(result.success).toBe(false);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { focalPoints: true, history: true } })).toEqual(task);
    // Também isola a validação de uma tarefa que está no estado correto para validar.
    await prisma.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    expect((await actions.validateTask(task.id)).success).toBe(false);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
    const created = await actions.createTask(previous, taskForm({ title: "Tarefa da outra unidade" }));
    expect(created.success).toBe(true);
    const agenda = await getAgendaData(new Date(2026, 10, 1), new Date(2026, 10, 30, 23));
    expect(agenda.tasks).toHaveLength(1);
    expect(agenda.tasks[0].unitId).toBe("unit-other");
    expect(agenda.tasks[0].title).toBe("Tarefa da outra unidade");
  });

  it("sem sessão não retorna tarefas, histórico ou diretório de funcionários", async () => {
    await create();
    context.cookies.clear();
    const { getAgendaData } = await import("../src/lib/tasks");
    expect(await getAgendaData(new Date(2026, 10, 1), new Date(2026, 10, 30))).toEqual({ currentUser: null, tasks: [], employees: [] });
  });
});

describe("transições e idempotência", () => {
  it("não valida pendência nem permite concluir ou editar tarefa encerrada", async () => {
    const task = await create();
    context.cookies.set("userId", "admin-test");
    expect((await actions.validateTask(task.id)).success).toBe(false);
    expect((await actions.completeTask(task.id)).success).toBe(true);
    const completed = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect((await actions.completeTask(task.id)).success).toBe(false);
    expect((await actions.updateTask(task.id, previous, taskForm())).success).toBe(false);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toEqual(completed);
    expect((await actions.validateTask(task.id)).success).toBe(true);
    expect((await actions.completeTask(task.id)).success).toBe(false);
    expect((await actions.updateTask(task.id, previous, taskForm())).success).toBe(false);
    expect(await prisma.taskHistory.count({ where: { taskId: task.id, action: "COMPLETE" } })).toBe(1);
  });

  it.each([false, true])("validação duplicada (concorrente=%s) gera uma única sucessora com os pontos focais", async (concurrent) => {
    const task = await create({ frequency: "MONTHLY", focalPoints: ["1001", "1002"] });
    await actions.completeTask(task.id);
    context.cookies.set("userId", "admin-test");
    const results = concurrent
      ? await Promise.all([actions.validateTask(task.id), actions.validateTask(task.id)])
      : [await actions.validateTask(task.id), await actions.validateTask(task.id)];
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(await prisma.task.count()).toBe(2);
    const next = await prisma.task.findUniqueOrThrow({ where: { sourceTaskId: task.id }, include: { focalPoints: true } });
    expect(next.focalPoints.map((employee) => employee.id).sort()).toEqual([1001, 1002]);
    expect(await prisma.taskHistory.count({ where: { taskId: task.id, action: "VALIDATE" } })).toBe(1);
    expect(await prisma.taskHistory.count({ where: { taskId: next.id, action: "CREATE" } })).toBe(1);
    // A garantia existe no banco, não apenas no caminho da Server Action.
    await expect(prisma.task.create({ data: { title: "Duplicada", dueDate: next.dueDate, unitId: next.unitId, createdById: "admin-test", sourceTaskId: task.id } })).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("rollback de auditoria", () => {
  it.each(["CREATE", "UPDATE", "COMPLETE", "VALIDATE", "RECURRENCE", "ARCHIVE", "RESTORE"])("falha em %s não deixa gravação parcial", async (stage) => {
    let task;
    if (stage !== "CREATE") task = await create({ frequency: "MONTHLY", focalPoints: ["1001"] });
    if (stage === "VALIDATE" || stage === "RECURRENCE") {
      await actions.completeTask(task!.id);
      context.cookies.set("userId", "admin-test");
    }
    if (stage === "ARCHIVE" || stage === "RESTORE") context.cookies.set("userId", "admin-test");
    if (stage === "RESTORE") await actions.archiveTask(task!.id, "Suspensa");
    const beforeTasks = await prisma.task.findMany({ orderBy: { id: "asc" }, include: { focalPoints: true } });
    const beforeHistory = await prisma.taskHistory.findMany({ orderBy: { id: "asc" } });
    const condition = stage === "RECURRENCE" ? "NEW.detail LIKE 'Gerada automaticamente%'" : `NEW.action = '${stage}'`;
    // Falha real de SQLite, depois da alteração da tarefa e antes de confirmar a transação.
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_history BEFORE INSERT ON TaskHistory WHEN ${condition} BEGIN SELECT RAISE(ABORT, 'Falha de auditoria injetada'); END`);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    context.revalidate.mockClear();
    try {
      const result = stage === "CREATE" ? await actions.createTask(previous, taskForm())
        : stage === "UPDATE" ? await actions.updateTask(task!.id, previous, taskForm({ title: "Alterada", focalPoints: ["1002"] }))
        : stage === "COMPLETE" ? await actions.completeTask(task!.id)
        : stage === "ARCHIVE" ? await actions.archiveTask(task!.id, "Suspensa")
        : stage === "RESTORE" ? await actions.restoreTask(task!.id)
        : await actions.validateTask(task!.id);
      expect(result.success).toBe(false);
      expect(await prisma.task.findMany({ orderBy: { id: "asc" }, include: { focalPoints: true } })).toEqual(beforeTasks);
      expect(await prisma.taskHistory.findMany({ orderBy: { id: "asc" } })).toEqual(beforeHistory);
      expect(context.revalidate).not.toHaveBeenCalled();
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER reject_history");
      log.mockRestore();
    }
  });
});

describe("restrição do modo demonstração", () => {
  it("desabilitar DEMO_MODE bloqueia sessão e troca de usuário", async () => {
    const before = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "false";
    try {
      expect(await getCurrentUser()).toBeNull();
      await actions.switchUser("admin@test.invalid");
      expect(context.setCookie).not.toHaveBeenCalled();
      expect((await actions.createTask(previous, taskForm())).success).toBe(false);
    } finally { process.env.DEMO_MODE = before; }
  });

  it("produção não aceita cookie de demonstração mesmo com flag habilitada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(await getCurrentUser()).toBeNull();
      await actions.switchUser("admin@test.invalid");
      expect(context.setCookie).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("restauração e consulta do arquivo", () => {
  it.each(["PENDING", "COMPLETED", "VALIDATED"] as const)("restaura tarefa %s sem mudar ciclo, prazo ou gerar recorrência", async (status) => {
    const task = await create({ frequency: "MONTHLY", focalPoints: ["1001"] });
    context.cookies.set("userId", "admin-test");
    await prisma.task.update({ where: { id: task.id }, data: { status } });
    expect((await actions.archiveTask(task.id, "Processo suspenso")).success).toBe(true);
    expect((await actions.restoreTask(task.id)).success).toBe(true);
    const restored = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { focalPoints: true, history: true } });
    expect(restored).toMatchObject({ status, dueDate: task.dueDate, archivedAt: null, archivedById: null, archiveReason: null, focalPoints: task.focalPoints });
    expect(restored.history).toContainEqual(expect.objectContaining({ action: "ARCHIVE", userId: "admin-test", detail: "Motivo: Processo suspenso" }));
    expect(restored.history).toContainEqual(expect.objectContaining({ action: "RESTORE", userId: "admin-test" }));
    expect(await prisma.task.count()).toBe(1);
    expect((await actions.restoreTask(task.id)).success).toBe(false);
    expect(await prisma.taskHistory.count({ where: { action: "RESTORE" } })).toBe(1);
  });

  it("oculta arquivadas da agenda e permite consulta de todos os prazos", async () => {
    const task = await create({ dueDate: "2020-01-10" });
    context.cookies.set("userId", "admin-test");
    await actions.archiveTask(task.id, "Tarefa antiga");
    const { getAgendaData } = await import("../src/lib/tasks");
    const start = new Date(2020, 0, 1), end = new Date(2020, 0, 31, 23);
    expect((await getAgendaData(start, end)).tasks).toEqual([]);
    const archived = await getAgendaData(new Date(2026, 10, 1), new Date(2026, 10, 30), true);
    expect(archived.tasks).toHaveLength(1);
    expect(archived.tasks[0].id).toBe(task.id);
    expect(archived.tasks[0].archivedBy?.name).toBe("Gestora");
    expect(archived.tasks[0].history).toHaveLength(2);
    expect(archived.employees).toEqual([]);
    context.cookies.set("userId", "viewer-test");
    expect((await getAgendaData(start, end, true)).tasks).toHaveLength(1);
    context.cookies.set("userId", "other-admin");
    expect((await getAgendaData(start, end, true)).tasks).toEqual([]);
    context.cookies.clear();
    expect((await getAgendaData(start, end, true)).tasks).toEqual([]);
  });

  it("tarefas arquivadas não aceitam edição, conclusão ou validação", async () => {
    const task = await create({ frequency: "MONTHLY" });
    context.cookies.set("userId", "admin-test");
    await actions.archiveTask(task.id, "Suspensa");
    expect((await actions.updateTask(task.id, previous, taskForm())).success).toBe(false);
    expect((await actions.completeTask(task.id)).success).toBe(false);
    // Mesmo em COMPLETED, arquivamento precisa bloquear a geração da próxima ocorrência.
    await prisma.task.update({ where: { id: task.id }, data: { status: "COMPLETED" } });
    expect((await actions.validateTask(task.id)).success).toBe(false);
    expect(await prisma.task.count()).toBe(1);
    expect(await prisma.taskHistory.count()).toBe(2);
  });

  it.each(["operator-test", "viewer-test", "other-admin", "missing"])("recusa arquivar/restaurar para %s", async (actor) => {
    const task = await create();
    context.cookies.set("userId", actor);
    expect((await actions.archiveTask(task.id, "Teste de acesso")).success).toBe(false);
    context.cookies.set("userId", "admin-test");
    await actions.archiveTask(task.id, "Suspensa");
    const snapshot = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    context.cookies.set("userId", actor);
    expect((await actions.restoreTask(task.id)).success).toBe(false);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toEqual(snapshot);
    expect(await prisma.taskHistory.count()).toBe(2);
  });

  it.each(["", "  ", "ab", "a".repeat(501)])("recusa motivo inválido sem gravação (%s)", async (reason) => {
    const task = await create();
    context.cookies.set("userId", "admin-test");
    expect((await actions.archiveTask(task.id, reason)).success).toBe(false);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).archivedAt).toBeNull();
    expect(await prisma.taskHistory.count()).toBe(1);
  });

  it.each(["archive", "restore"] as const)("chamadas simultâneas de %s produzem uma única mudança e auditoria", async (action) => {
    const task = await create();
    context.cookies.set("userId", "admin-test");
    if (action === "restore") await actions.archiveTask(task.id, "Suspensa");
    const execute = () => action === "archive" ? actions.archiveTask(task.id, "Suspensa") : actions.restoreTask(task.id);
    const results = await Promise.all([execute(), execute()]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(await prisma.taskHistory.count({ where: { action: action === "archive" ? "ARCHIVE" : "RESTORE" } })).toBe(1);
  });

  it("arquivar origem preserva o vínculo e a tarefa sucessora", async () => {
    const task = await create({ frequency: "MONTHLY" });
    await actions.completeTask(task.id);
    context.cookies.set("userId", "admin-test");
    await actions.validateTask(task.id);
    await actions.archiveTask(task.id, "Ocorrência encerrada");
    const next = await prisma.task.findUniqueOrThrow({ where: { sourceTaskId: task.id } });
    expect(next.archivedAt).toBeNull();
    expect(next.status).toBe("PENDING");
    expect((await actions.restoreTask(task.id)).success).toBe(true);
    expect(await prisma.task.count()).toBe(2);
  });

  it("não oferece uma Server Action para exclusão definitiva", () => {
    expect(actions).not.toHaveProperty("deleteTask");
  });
});

// O mesmo banco temporário exercita a administração com as fronteiras reais de sessão.
describe("gestão administrativa de usuários", () => {
  async function management() { return import("../src/user-actions"); }
  function profile(values: Record<string, string> = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ name: "Nova Pessoa", email: "nova@test.invalid", role: "OPERATOR", ...values })) form.set(key, value);
    return form;
  }
  it.each(["operator-test", "viewer-test", ""])('bloqueia cadastro e consulta para %s', async (id) => {
    context.cookies.set("userId", id);
    expect((await (await management()).createManagedUser(profile())).success).toBe(false);
    expect(await (await import("../src/lib/managed-users")).getManagedUsers()).toBeNull();
    expect((await (await management()).updateManagedUser("admin-test", profile())).success).toBe(false);
  });
  it("cadastra com e-mail normalizado e unidade da sessão, ignorando unidade enviada", async () => {
    context.cookies.set("userId", "admin-test");
    const result = await (await management()).createManagedUser(profile({ email: "  NOVA@Test.Invalid  ", unitId: "unit-other" }));
    expect(result.success).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "nova@test.invalid" } });
    expect(user).toMatchObject({ unitId: "unit-test", role: "OPERATOR" });
    expect(await prisma.authUser.findUnique({ where: { id: user.id } })).toBeNull();
    await prisma.user.delete({ where: { id: user.id } });
  });
  it("recusa duplicação inclusive com maiúsculas e cadastro externo", async () => {
    context.cookies.set("userId", "admin-test");
    expect((await (await management()).createManagedUser(profile({ email: " OTHER@TEST.INVALID " }))).success).toBe(false);
  });
  it("recusa entradas inválidas", async () => {
    context.cookies.set("userId", "admin-test");
    for (const fields of [{ name: " " }, { email: "invalido" }, { role: "SUPERADMIN" }] as Record<string, string>[]) {
      expect((await (await management()).createManagedUser(profile(fields))).success).toBe(false);
    }
  });
  it("isola consulta e edição por unidade e impede autopromoção de operador", async () => {
    context.cookies.set("userId", "admin-test");
    const users = await (await import("../src/lib/managed-users")).getManagedUsers();
    expect(users?.map((user) => user.id)).not.toContain("other-admin");
    expect(users?.every((user) => !('identity' in user))).toBe(true);
    expect((await (await management()).updateManagedUser("other-admin", profile())).success).toBe(false);
    context.cookies.set("userId", "operator-test");
    expect((await (await management()).updateManagedUser("operator-test", profile({ role: "ADMIN" }))).success).toBe(false);
  });
  it("bloqueia remover o próprio perfil de gestor", async () => {
    context.cookies.set("userId", "admin-test");
    expect((await (await management()).updateManagedUser("admin-test", profile({ role: "VIEWER" }))).success).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "admin-test" } })).role).toBe("ADMIN");
  });
  it("atualiza perfil e identidade atomicamente e revoga sessões", async () => {
    context.cookies.set("userId", "admin-test");
    await prisma.authUser.create({ data: { id: "operator-test", name: "Operador", email: "operator@test.invalid" } });
    await prisma.authSession.create({ data: { id: "management-session", token: "management-token", userId: "operator-test", expiresAt: new Date(Date.now()+3600000) } });
    const result = await (await management()).updateManagedUser("operator-test", profile({ name: "Pessoa Editada", role: "VIEWER", email: "forged@test.invalid", unitId: "unit-other" }));
    expect(result.success).toBe(true);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "operator-test" } })).toMatchObject({ name: "Pessoa Editada", role: "VIEWER", email: "operator@test.invalid", unitId: "unit-test" });
    expect((await prisma.authUser.findUniqueOrThrow({ where: { id: "operator-test" } })).name).toBe("Pessoa Editada");
    expect(await prisma.authSession.count({ where: { userId: "operator-test" } })).toBe(0);
    await prisma.authUser.delete({ where: { id: "operator-test" } });
    await prisma.user.update({ where: { id: "operator-test" }, data: { name: "Operador", role: "OPERATOR" } });
  });
});

describe("atomicidade administrativa", () => {
  it("reverte perfil se a revogação de sessões falhar", async () => {
    context.cookies.set("userId", "admin-test");
    await prisma.authUser.create({ data: { id: "operator-test", name: "Operador", email: "operator@test.invalid" } });
    await prisma.authSession.create({ data: { id: "rollback-management", token: "rollback-management-token", userId: "operator-test", expiresAt: new Date(Date.now()+3600000) } });
    await prisma.$executeRawUnsafe("CREATE TRIGGER fail_management_session BEFORE DELETE ON AuthSession BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    try {
      const form = new FormData(); form.set("name", "Mudança inválida"); form.set("role", "VIEWER");
      expect((await (await import("../src/user-actions")).updateManagedUser("operator-test", form)).success).toBe(false);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: "operator-test" } })).role).toBe("OPERATOR");
      expect((await prisma.authUser.findUniqueOrThrow({ where: { id: "operator-test" } })).name).toBe("Operador");
      expect(await prisma.authSession.count({ where: { userId: "operator-test" } })).toBe(1);
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER fail_management_session");
      await prisma.authUser.delete({ where: { id: "operator-test" } });
    }
  });
});

describe("auditoria administrativa", () => {
  function form(name = "Pessoa Auditada", role = "VIEWER") {
    const data = new FormData(); data.set("name", name); data.set("role", role); data.set("email", "audit@test.invalid"); return data;
  }
  beforeEach(async () => {
    context.cookies.set("userId", "admin-test");
    await prisma.userAudit.deleteMany();
  });
  it("registra cadastro com autoria e snapshots sem credenciais", async () => {
    const { createManagedUser } = await import("../src/user-actions");
    expect((await createManagedUser(form())).success).toBe(true);
    const entry = await prisma.userAudit.findFirstOrThrow();
    expect(entry).toMatchObject({ action: "CREATE", actorId: "admin-test", actorName: "Gestora", unitId: "unit-test", userEmail: "audit@test.invalid", nameBefore: null, roleBefore: null, nameAfter: "Pessoa Auditada", roleAfter: "VIEWER" });
    await prisma.user.delete({ where: { id: entry.userId } });
    expect(await prisma.userAudit.count()).toBe(1);
  });
  it("registra antes/depois e preserva autoria após mudar o nome do gestor", async () => {
    const { updateManagedUser } = await import("../src/user-actions");
    expect((await updateManagedUser("viewer-test", form())).success).toBe(true);
    expect(await prisma.userAudit.findFirstOrThrow()).toMatchObject({ action: "UPDATE", nameBefore: "Leitor", nameAfter: "Pessoa Auditada", roleBefore: "VIEWER", roleAfter: "VIEWER" });
    await prisma.user.update({ where: { id: "admin-test" }, data: { name: "Outro nome" } });
    expect((await prisma.userAudit.findFirstOrThrow()).actorName).toBe("Gestora");
    await prisma.user.update({ where: { id: "admin-test" }, data: { name: "Gestora" } });
    await prisma.user.update({ where: { id: "viewer-test" }, data: { name: "Leitor" } });
  });
  it("não registra nem revoga sessões ao salvar sem mudanças", async () => {
    await prisma.authUser.create({ data: { id: "viewer-test", name: "Leitor", email: "viewer@test.invalid" } });
    await prisma.authSession.create({ data: { id: "no-change", token: "no-change", userId: "viewer-test", expiresAt: new Date(Date.now()+3600000) } });
    expect((await (await import("../src/user-actions")).updateManagedUser("viewer-test", form("Leitor"))).success).toBe(true);
    expect(await prisma.userAudit.count()).toBe(0);
    expect(await prisma.authSession.count({ where: { userId: "viewer-test" } })).toBe(1);
    await prisma.authUser.delete({ where: { id: "viewer-test" } });
  });
  it("restringe a consulta de histórico ao gestor da própria unidade", async () => {
    await prisma.userAudit.createMany({ data: ["unit-test", "unit-other"].map((unitId) => ({ unitId, actorId: "admin-test", actorName: "Gestora", userId: "viewer-test", userEmail: "viewer@test.invalid", action: "UPDATE", nameAfter: "Leitor", roleAfter: "VIEWER" })) });
    const { getUserAudit } = await import("../src/lib/managed-users");
    expect((await getUserAudit())?.map((entry) => entry.unitId)).toEqual(["unit-test"]);
    for (const id of ["operator-test", "viewer-test", ""]) {
      context.cookies.set("userId", id);
      expect(await getUserAudit()).toBeNull();
    }
  });
  it("limita a consulta aos 100 eventos mais recentes", async () => {
    await prisma.userAudit.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ unitId: "unit-test", actorId: "admin-test", actorName: "Gestora", userId: "viewer-test", userEmail: "viewer@test.invalid", action: "UPDATE", nameAfter: "Leitor", roleAfter: "VIEWER", timestamp: new Date(2026, 0, 1, 0, i) })) });
    const entries = await (await import("../src/lib/managed-users")).getUserAudit();
    expect(entries).toHaveLength(100);
    expect(entries?.[0].timestamp).toEqual(new Date(2026, 0, 1, 0, 100));
  });
  it("falha na auditoria reverte cadastro, perfil e revogação de sessões", async () => {
    await prisma.authUser.create({ data: { id: "viewer-test", name: "Leitor", email: "viewer@test.invalid" } });
    await prisma.authSession.create({ data: { id: "audit-rollback", token: "audit-rollback", userId: "viewer-test", expiresAt: new Date(Date.now()+3600000) } });
    await prisma.$executeRawUnsafe("CREATE TRIGGER fail_user_audit BEFORE INSERT ON UserAudit BEGIN SELECT RAISE(ABORT, 'injected audit failure'); END");
    try {
      const actions = await import("../src/user-actions");
      expect((await actions.createManagedUser(form())).success).toBe(false);
      expect(await prisma.user.count({ where: { email: "audit@test.invalid" } })).toBe(0);
      expect((await actions.updateManagedUser("viewer-test", form("Pessoa Auditada", "OPERATOR"))).success).toBe(false);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: "viewer-test" } })).toMatchObject({ name: "Leitor", role: "VIEWER" });
      expect((await prisma.authUser.findUniqueOrThrow({ where: { id: "viewer-test" } })).name).toBe("Leitor");
      expect(await prisma.authSession.count({ where: { userId: "viewer-test" } })).toBe(1);
      expect(await prisma.userAudit.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER fail_user_audit");
      await prisma.authUser.delete({ where: { id: "viewer-test" } });
    }
  });
});

describe("ativação de contas", () => {
  beforeEach(async () => {
    context.cookies.set("userId", "admin-test");
    await prisma.user.updateMany({ data: { isActive: true } });
    await prisma.userAudit.deleteMany();
  });
  afterEach(async () => { await prisma.user.updateMany({ data: { isActive: true } }); });
  it("desativa, revoga sessões e reativa preservando senha e histórico", async () => {
    const { provisionPassword } = await import("../src/lib/provision-user");
    await provisionPassword(prisma, "viewer@test.invalid", "Senha-teste-ativacao-2026!");
    const account = await prisma.authAccount.findFirstOrThrow({ where: { userId: "viewer-test" } });
    await prisma.authSession.create({ data: { id: "activation-session", token: "activation-session", userId: "viewer-test", expiresAt: new Date(Date.now()+3600000) } });
    const { setManagedUserActive } = await import("../src/user-actions");
    expect((await setManagedUserActive("viewer-test", false)).success).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "viewer-test" } })).isActive).toBe(false);
    expect(await prisma.authSession.count({ where: { userId: "viewer-test" } })).toBe(0);
    expect(await prisma.userAudit.findFirstOrThrow()).toMatchObject({ action: "DEACTIVATE", actorId: "admin-test", activeBefore: true, activeAfter: false });
    expect((await setManagedUserActive("viewer-test", false)).success).toBe(false);
    expect((await setManagedUserActive("viewer-test", true)).success).toBe(true);
    expect(await prisma.userAudit.count()).toBe(2);
    expect(await prisma.authSession.count({ where: { userId: "viewer-test" } })).toBe(0);
    expect((await prisma.authAccount.findFirstOrThrow({ where: { userId: "viewer-test" } })).password).toBe(account.password);
    await prisma.authUser.delete({ where: { id: "viewer-test" } });
  });
  it.each(["operator-test", "viewer-test", ""])('recusa alteração por %s', async (id) => {
    context.cookies.set("userId", id);
    expect((await (await import("../src/user-actions")).setManagedUserActive("other-admin", false)).success).toBe(false);
    expect(await prisma.userAudit.count()).toBe(0);
  });
  it("impede desativar a si próprio e atingir outra unidade", async () => {
    const { setManagedUserActive } = await import("../src/user-actions");
    for (const id of ["admin-test", "other-admin", "missing"]) expect((await setManagedUserActive(id, false)).success).toBe(false);
    expect(await prisma.userAudit.count()).toBe(0);
  });
  it("cookie demo antigo não dá acesso nem permite mutações", async () => {
    await prisma.user.update({ where: { id: "operator-test" }, data: { isActive: false } });
    context.cookies.set("userId", "operator-test");
    expect(await getCurrentUser()).toBeNull();
    expect((await actions.createTask(previous, taskForm())).success).toBe(false);
    const { getAgendaData } = await import("../src/lib/tasks");
    expect((await getAgendaData(new Date(2026,0,1), new Date(2027,0,1))).tasks).toEqual([]);
    context.cookies.clear();
    await actions.switchUser("operator@test.invalid");
    expect(context.cookies.get("userId")).toBeUndefined();
  });
  it("conta de gestor desativada perde acesso administrativo", async () => {
    await prisma.user.update({ where: { id: "admin-test" }, data: { isActive: false } });
    const { getManagedUsers, getUserAudit } = await import("../src/lib/managed-users");
    expect(await getManagedUsers()).toBeNull(); expect(await getUserAudit()).toBeNull();
    expect((await (await import("../src/user-actions")).setManagedUserActive("viewer-test", false)).success).toBe(false);
  });
  it("falha na auditoria reverte desativação e revogação", async () => {
    await prisma.authUser.create({ data: { id: "viewer-test", name: "Leitor", email: "viewer@test.invalid" } });
    await prisma.authSession.create({ data: { id: "activation-rollback", token: "activation-rollback", userId: "viewer-test", expiresAt: new Date(Date.now()+3600000) } });
    await prisma.$executeRawUnsafe("CREATE TRIGGER fail_activation_audit BEFORE INSERT ON UserAudit BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    try {
      expect((await (await import("../src/user-actions")).setManagedUserActive("viewer-test", false)).success).toBe(false);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: "viewer-test" } })).isActive).toBe(true);
      expect(await prisma.authSession.count({ where: { userId: "viewer-test" } })).toBe(1);
      expect(await prisma.userAudit.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER fail_activation_audit");
      await prisma.authUser.delete({ where: { id: "viewer-test" } });
    }
  });
});

describe("consulta da lista de tarefas", () => {
  async function list(params: Record<string, string> = {}) {
    const { resolveTaskListParams } = await import("../src/lib/task-list-params");
    return (await import("../src/lib/task-list")).getTaskListData(resolveTaskListParams(params));
  }
  async function seedList() {
    const today = new Date(); today.setHours(12,0,0,0);
    await prisma.task.createMany({ data: [
      { id: "list-old", title: "Remessa antiga", description: "Documentos fiscais", dueDate: new Date(2020,0,1,12), createdById: "operator-test", unitId: "unit-test" },
      { id: "list-today", title: "Hoje", dueDate: today, createdById: "operator-test", unitId: "unit-test" },
      { id: "list-completed", title: "Remessa concluída", status: "COMPLETED", dueDate: new Date(2020,0,2,12), createdById: "operator-test", unitId: "unit-test" },
      { id: "list-validated", title: "Validada", status: "VALIDATED", dueDate: today, createdById: "operator-test", unitId: "unit-test" },
      { id: "list-archived", title: "Remessa arquivada", archivedAt: today, dueDate: new Date(2020,0,1,12), createdById: "operator-test", unitId: "unit-test" },
      { id: "list-other", title: "Remessa externa", dueDate: new Date(2020,0,1,12), createdById: "other-admin", unitId: "unit-other" },
    ] });
  }
  it("consulta todos os períodos sem arquivadas ou dados de outra unidade", async () => {
    await seedList();
    const result = await list();
    expect(result.total).toBe(4);
    expect(result.tasks.map((task) => task.id)).not.toContain("list-other");
    expect(result.tasks.map((task) => task.id)).not.toContain("list-archived");
    expect(result.employees).toHaveLength(2);
  });
  it("busca título/descrição e combina com estado", async () => {
    await seedList();
    expect((await list({ q: "REMESSA", status: "COMPLETED" })).tasks.map((task) => task.id)).toEqual(["list-completed"]);
    expect((await list({ q: "fiscais" })).tasks.map((task) => task.id)).toEqual(["list-old"]);
    expect((await list({ q: "inexistente" })).total).toBe(0);
    expect((await list({ status: "VALIDATED" })).tasks.map((task) => task.id)).toEqual(["list-validated"]);
  });
  it("todas as vencidas inclui meses antigos e exclui hoje e tarefas finalizadas", async () => {
    await seedList();
    expect((await list({ overdue: "true", status: "COMPLETED" })).tasks.map((task) => task.id)).toEqual(["list-old"]);
    expect((await list({ overdue: "true", q: "Hoje" })).total).toBe(0);
  });
  it("visualizador consulta com histórico sem receber diretório para edição", async () => {
    await create();
    context.cookies.set("userId", "viewer-test");
    const result = await list();
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].history).toHaveLength(1);
    expect(result.tasks[0].focalPoints).toBeDefined();
    expect(result.employees).toEqual([]);
  });
  it("anônimo não recebe tarefas nem funcionários", async () => {
    await seedList(); context.cookies.clear();
    expect(await list()).toMatchObject({ currentUser: null, tasks: [], employees: [], total: 0 });
  });
  it("pagina com ordem estável e ajusta página fora do intervalo", async () => {
    await prisma.task.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ id: `paged-${String(i).padStart(2,"0")}`, title: "Mesmo prazo", dueDate: new Date(2026,0,1,12), unitId: "unit-test", createdById: "operator-test" })) });
    const first = await list(); const second = await list({ page: "2" });
    expect(first.tasks).toHaveLength(25); expect(first.pages).toBe(2);
    expect(second.tasks.map((task) => task.id)).toEqual(["paged-25"]);
    expect((await list({ page: "999" })).page).toBe(2);
  });
});

describe("filtros por ponto focal e prazo", () => {
  async function list(params: Record<string, string> = {}) {
    return (await import("../src/lib/task-list")).getTaskListData((await import("../src/lib/task-list-params")).resolveTaskListParams(params));
  }
  beforeEach(async () => {
    await prisma.task.create({ data: { id: "range-start", title: "Remessa início", description: "Documentos", dueDate: new Date(2020,0,1,0,0,0), createdById: "operator-test", unitId: "unit-test", focalPoints: { connect: { id: 1001 } } } });
    await prisma.task.create({ data: { id: "range-end", title: "Remessa fim", dueDate: new Date(2020,0,2,23,59,59,999), createdById: "operator-test", unitId: "unit-test", focalPoints: { connect: [{ id: 1001 }, { id: 1002 }] } } });
    await prisma.task.create({ data: { id: "range-outside", title: "Fora", dueDate: new Date(2020,0,3,0,0,0), createdById: "operator-test", unitId: "unit-test" } });
  });
  it("inclui os limites completos dos dias e exclui o dia seguinte", async () => {
    expect((await list({ from: "2020-01-01", to: "2020-01-02" })).tasks.map((task) => task.id)).toEqual(["range-start", "range-end"]);
  });
  it("permite apenas data inicial, apenas final e um mesmo dia", async () => {
    expect((await list({ from: "2020-01-03" })).total).toBe(1);
    expect((await list({ to: "2020-01-01" })).tasks.map((task) => task.id)).toEqual(["range-start"]);
    expect((await list({ from: "2020-01-02", to: "2020-01-02" })).tasks.map((task) => task.id)).toEqual(["range-end"]);
  });
  it("combina ponto focal, intervalo, busca e vencidas sem duplicar tarefas", async () => {
    const result = await list({ focalPoint: "1001", from: "2020-01-01", to: "2020-01-02", q: "Remessa", overdue: "true" });
    expect(result.total).toBe(2);
    expect((await list({ focalPoint: "1002", to: "2020-01-02" })).tasks.map((task) => task.id)).toEqual(["range-end"]);
    expect((await list({ focalPoint: "1001", status: "VALIDATED" })).total).toBe(0);
  });
  it("não amplia a busca com datas ou matrículas inválidas", async () => {
    const invalid: Record<string, string>[] = [{ from: "2020-02-30" }, { from: "2020-02-02", to: "2020-01-01" }, { focalPoint: "invalid" }];
    for (const params of invalid) {
      expect((await list(params)).tasks).toEqual([]);
    }
    expect((await list({ focalPoint: "999999" })).tasks).toEqual([]);
  });
  it("visualizador filtra sem receber diretório global ou e-mails das opções", async () => {
    await prisma.employee.create({ data: { id: 1003, name: "Pessoa externa", email: "external-focal@test.invalid" } });
    await prisma.task.create({ data: { id: "external-focal-task", title: "Outra unidade", dueDate: new Date(), createdById: "other-admin", unitId: "unit-other", focalPoints: { connect: { id: 1003 } } } });
    context.cookies.set("userId", "viewer-test");
    const result = await list({ focalPoint: "1001" });
    expect(result.total).toBe(2); expect(result.employees).toEqual([]);
    expect(result.focalOptions.map((entry) => entry.id)).toEqual([1001,1002]);
    expect(result.focalOptions.every((entry) => !('email' in entry))).toBe(true);
    expect((await list({ focalPoint: "1003" })).total).toBe(0);
    context.cookies.clear();
    expect((await list()).focalOptions).toEqual([]);
    await prisma.task.delete({ where: { id: "external-focal-task" } });
    await prisma.employee.delete({ where: { id: 1003 } });
  });
});

describe("fila de validação", () => {
  it.each(["operator-test", "viewer-test", ""])("recusa consulta e contador para %s", async (id) => {
    context.cookies.set("userId", id);
    const { getValidationQueue, getValidationCount } = await import("../src/lib/validation-queue");
    expect(await getValidationQueue("", 1)).toBeNull(); expect(await getValidationCount()).toBeNull();
  });
  it("inclui apenas concluídas ativas da unidade em todos os períodos e ordena por conclusão", async () => {
    context.cookies.set("userId", "admin-test");
    await prisma.task.createMany({ data: [
      { id: "q-first", title: "Antiga", status: "COMPLETED", dueDate: new Date(2020,0,1), completedAt: new Date(2026,0,1), unitId: "unit-test", createdById: "operator-test" },
      { id: "q-last", title: "Recente", status: "COMPLETED", dueDate: new Date(2019,0,1), completedAt: new Date(2026,1,1), unitId: "unit-test", createdById: "operator-test" },
      { id: "q-legacy", title: "Sem data", status: "COMPLETED", dueDate: new Date(2021,0,1), unitId: "unit-test", createdById: "operator-test" },
      { id: "q-pending", title: "Pendente", status: "PENDING", dueDate: new Date(), unitId: "unit-test", createdById: "operator-test" },
      { id: "q-validated", title: "Validada", status: "VALIDATED", dueDate: new Date(), unitId: "unit-test", createdById: "operator-test" },
      { id: "q-archive", title: "Arquivada", status: "COMPLETED", archivedAt: new Date(), dueDate: new Date(), unitId: "unit-test", createdById: "operator-test" },
      { id: "q-other", title: "Externa", status: "COMPLETED", dueDate: new Date(), unitId: "unit-other", createdById: "other-admin" },
    ] });
    const { getValidationQueue, getValidationCount } = await import("../src/lib/validation-queue");
    expect(await getValidationCount()).toBe(3);
    expect((await getValidationQueue("",1))?.tasks.map((task) => task.id)).toEqual(["q-legacy", "q-first", "q-last"]);
    expect((await getValidationQueue("externa",1))?.total).toBe(0);
  });
  it("busca título/descrição e pagina com ordem estável", async () => {
    context.cookies.set("userId", "admin-test");
    await prisma.task.createMany({ data: Array.from({ length: 26 }, (_, index) => ({ id: `queue-${String(index).padStart(2,"0")}`, title: "Remessa", description: "Documentação fiscal", status: "COMPLETED", completedAt: new Date(2026,0,1), dueDate: new Date(2020,0,1), unitId: "unit-test", createdById: "operator-test" })) });
    const { getValidationQueue } = await import("../src/lib/validation-queue");
    expect((await getValidationQueue("REMESSA",1))?.tasks).toHaveLength(25);
    const second = await getValidationQueue("fiscal",999);
    expect(second?.page).toBe(2); expect(second?.tasks.map((task) => task.id)).toEqual(["queue-25"]);
    expect((await getValidationQueue("ausente",1))?.total).toBe(0);
  });
  it("validar remove da fila, atualiza contador e revalida os três caminhos", async () => {
    const task = await create({ frequency: "MONTHLY" });
    expect((await actions.completeTask(task.id)).success).toBe(true);
    context.cookies.set("userId", "admin-test");
    const { getValidationQueue, getValidationCount } = await import("../src/lib/validation-queue");
    expect(await getValidationCount()).toBe(1);
    expect((await getValidationQueue("",1))?.tasks[0].history.some((entry) => entry.action === "COMPLETE")).toBe(true);
    expect((await actions.validateTask(task.id)).success).toBe(true);
    expect(await getValidationCount()).toBe(0);
    expect((await getValidationQueue("",1))?.tasks).toEqual([]);
    expect(await prisma.task.count({ where: { sourceTaskId: task.id } })).toBe(1);
    for (const path of ["/", "/tarefas", "/validacoes"]) expect(context.revalidate).toHaveBeenCalledWith(path);
  });
});

describe("busca sem acentos", () => {
  async function list(q: string) {
    return (await import("../src/lib/task-list")).getTaskListData((await import("../src/lib/task-list-params")).resolveTaskListParams({ q }));
  }
  it("encontra título e descrição com ou sem acentos, sem alterar a exibição", async () => {
    const task = await create({ title: "Relatório de Validação", description: "Reunião de órgãos técnicos" });
    for (const q of ["relatorio", "RELATÓRIO", "validacao", "reuniao", "ÓRGÃOS"]) expect((await list(q)).tasks.map((entry) => entry.id)).toEqual([task.id]);
    const result = (await list("relatorio")).tasks[0];
    expect(result.title).toBe("Relatório de Validação"); expect(result.description).toBe("Reunião de órgãos técnicos");
  });
  it("atualiza a busca após editar e não mantém termos antigos", async () => {
    const task = await create({ title: "Relatório antigo", description: "Informações antigas" });
    expect((await actions.updateTask(task.id, previous, taskForm({ title: "Reunião nova", description: "Órgão responsável" }))).success).toBe(true);
    expect((await list("relatorio")).total).toBe(0);
    expect((await list("reuniao")).total).toBe(1);
    expect((await list("orgao")).total).toBe(1);
  });
  it("triggers também mantêm busca de gravações diretas e formas Unicode decompostas", async () => {
    const task = await create();
    await prisma.task.update({ where: { id: task.id }, data: { title: "Reunia\u0303o", description: "AÇAÍ e frequência" } });
    expect((await list("reunião")).total).toBe(1);
    expect((await list("ACAI")).total).toBe(1);
    const { normalizeSearchText } = await import("../src/lib/search-text");
    const row = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(row.searchText).toBe(normalizeSearchText(`${row.title}\n${row.description}`));
  });
  it("fila de validação usa a mesma busca e continua isolando unidade", async () => {
    const task = await create({ title: "Análise de relatório", description: "Validação técnica", frequency: "MONTHLY" });
    await actions.completeTask(task.id);
    context.cookies.set("userId", "admin-test");
    const { getValidationQueue } = await import("../src/lib/validation-queue");
    expect((await getValidationQueue("ANALISE",1))?.tasks.map((entry) => entry.id)).toEqual([task.id]);
    expect((await getValidationQueue("validacao",1))?.total).toBe(1);
    await actions.validateTask(task.id);
    const next = await prisma.task.findFirstOrThrow({ where: { sourceTaskId: task.id } });
    expect((await list("analise")).tasks.map((entry) => entry.id)).toContain(next.id);
    context.cookies.set("userId", "other-admin"); expect((await list("analise")).total).toBe(0);
  });
});

describe("exportação CSV", () => {
  async function exportCsv(query = "") { return (await import("../src/app/api/tarefas/exportar/route")).GET(new Request(`http://localhost/api/tarefas/exportar${query}`)); }
  it("exige identificação e recusa filtros inválidos", async () => {
    context.cookies.clear(); expect((await exportCsv()).status).toBe(401);
    context.cookies.set("userId", "operator-test");
    expect((await exportCsv("?from=2026-02-30")).status).toBe(400);
  });
  it.each(["operator-test", "viewer-test", "admin-test"])("exporta apenas dados da unidade para %s", async (id) => {
    await create({ title: "Relatório exportável", focalPoints: ["1001"] });
    await prisma.task.create({ data: { id: "export-other", title: "Segredo de outra unidade", unitId: "unit-other", createdById: "other-admin", dueDate: new Date() } });
    context.cookies.set("userId", id);
    const response = await exportCsv("?q=relatorio&focalPoint=1001&unitId=unit-other");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const content = await response.text();
    expect(content).toContain("Relatório exportável"); expect(content).not.toContain("Segredo de outra unidade");
    expect(content).not.toContain("@test.invalid"); expect(content).not.toContain("searchText");
  });
  it("respeita estado, prazo, ponto focal, vencidas e exclusão de arquivadas", async () => {
    const task = await create({ title: "Relatório alvo", dueDate: "2020-01-01", focalPoints: ["1001"] });
    await create({ title: "Relatório de outro prazo", dueDate: "2020-02-01", focalPoints: ["1001"] });
    await create({ title: "Relatório sem ponto focal", dueDate: "2020-01-01" });
    const response = await exportCsv("?q=relatorio&status=PENDING&overdue=true&from=2020-01-01&to=2020-01-01&focalPoint=1001");
    expect((await response.text()).split("\r\n")).toHaveLength(3);
    context.cookies.set("userId", "admin-test"); await actions.archiveTask(task.id,"Arquivada para teste");
    expect(await (await exportCsv("?q=relatorio%20alvo")).text()).not.toContain("Relatório alvo");
  });
  it("exporta todas as páginas e não só os 25 itens exibidos", async () => {
    await prisma.task.createMany({ data: Array.from({ length: 26 }, (_, index) => ({ title: `Exportável ${index}`, unitId: "unit-test", createdById: "operator-test", dueDate: new Date(2026,0,1) })) });
    const response = await exportCsv("?page=2");
    expect((await response.text()).split("\r\n")).toHaveLength(28);
  });
  it("recusa exportação acima do limite em vez de truncar", async () => {
    await prisma.task.createMany({ data: Array.from({ length: 5001 }, (_, index) => ({ title: `Limite ${index}`, unitId: "unit-test", createdById: "operator-test", dueDate: new Date(2026, 0, 1) })) });
    const response = await exportCsv(); expect(response.status).toBe(413);
    expect((await response.json()).message).toContain("Refine os filtros");
  });
});

describe("preparação dos perfis de demonstração", () => {
  it("cria Carlos na unidade existente sem redefinir nomes, perfis ou situação", async () => {
    await prisma.user.create({ data: { id: "legacy-demo-admin", name: "Nome preservado", email: "admin@banco.com", role: "VIEWER", isActive: false, unitId: "unit-test" } });
    try {
      const { prepareDemoProfiles } = await import("../src/lib/demo-profiles");
      await prepareDemoProfiles(prisma); await prepareDemoProfiles(prisma);
      expect(await prisma.user.findUniqueOrThrow({ where: { email: "admin@banco.com" } })).toMatchObject({ name: "Nome preservado", role: "VIEWER", isActive: false });
      const carlos = await prisma.user.findUniqueOrThrow({ where: { email: "leitor@banco.com" } });
      expect(carlos).toMatchObject({ role: "VIEWER", isActive: true, unitId: "unit-test" });
      expect((await actions.switchUser("leitor@banco.com"))?.success).toBe(true);
      expect((await getCurrentUser())?.id).toBe(carlos.id);
    } finally { await prisma.user.deleteMany({ where: { email: { in: ["admin@banco.com", "operador@banco.com", "leitor@banco.com"] } } }); }
  });
  it("recusa preparação com autenticação real configurada", async () => {
    const previousSecret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = "segredo-de-teste";
    try { await expect((await import("../src/lib/demo-profiles")).prepareDemoProfiles(prisma)).rejects.toThrow("somente em desenvolvimento"); }
    finally { if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = previousSecret; }
  });
  it("informa quando o perfil não existe ou está desativado", async () => {
    expect((await actions.switchUser("missing@test.invalid"))?.message).toContain("demo:prepare");
    await prisma.user.update({ where: { id: "viewer-test" }, data: { isActive: false } });
    try { expect((await actions.switchUser("viewer@test.invalid"))?.message).toContain("desativada"); }
    finally { await prisma.user.update({ where: { id: "viewer-test" }, data: { isActive: true } }); }
  });
});

describe("Meu dia", () => {
  const now = new Date("2026-12-31T15:00:00-03:00");
  async function daily(focal: number | null = null) { return (await import("../src/lib/my-day")).getMyDayData(focal, now); }
  it("separa limites civis sem sobreposição, exclui finalizadas, arquivadas e outra unidade", async () => {
    for (const [title, date] of [["Vencida", "2026-12-30T23:59:59-03:00"], ["Hoje início", "2026-12-31T00:00:00-03:00"], ["Hoje fim", "2026-12-31T23:59:59-03:00"], ["Amanhã", "2027-01-01T00:00:00-03:00"], ["Sétimo dia", "2027-01-07T23:59:59-03:00"], ["Fora", "2027-01-08T00:00:00-03:00"]]) {
      await prisma.task.create({ data: { title, dueDate: new Date(date), unitId: "unit-test", createdById: "operator-test" } });
    }
    for (const data of [{ status: "COMPLETED" as const }, { status: "VALIDATED" as const }, { archivedAt: now }, { unitId: "unit-other" }]) await prisma.task.create({ data: { title: "Oculta", dueDate: now, unitId: "unit-test", createdById: "operator-test", ...data } });
    const result = await daily();
    expect(result.groups.map((group) => group.tasks.map((task) => task.title))).toEqual([["Vencida"], ["Hoje início", "Hoje fim"], ["Amanhã", "Sétimo dia"]]);
    expect(result.groups.map((group) => group.total)).toEqual([1, 2, 2]);
  });
  it("filtra ponto focal, limita detalhes a 25 e mantém total e link completo", async () => {
    for (let index = 0; index < 27; index++) await prisma.task.create({ data: { title: `Tarefa ${index}`, dueDate: now, unitId: "unit-test", createdById: "operator-test", focalPoints: { connect: { id: 1001 } } } });
    const group = (await daily(1001)).groups[1];
    expect(group.total).toBe(27); expect(group.tasks).toHaveLength(25);
    expect(Object.fromEntries(new URL(group.href, "http://localhost").searchParams)).toEqual({ status: "PENDING", from: "2026-12-31", to: "2026-12-31", focalPoint: "1001" });
    expect((await daily(1002)).groups.map((group) => group.total)).toEqual([0, 0, 0]);
  });
  it("permite leitura sem diretório de edição e não retorna dados sem sessão", async () => {
    await create({ dueDate: "2026-12-31", focalPoints: ["1001"] });
    context.cookies.set("userId", "viewer-test");
    const result = await daily(); expect(result.groups[1].total).toBe(1); expect(result.employees).toEqual([]); expect(result.focalOptions).toEqual([{ id: 1001, name: "Ponto focal A" }]);
    context.cookies.clear(); expect(await daily()).toMatchObject({ currentUser: null, groups: [], employees: [], focalOptions: [] });
  });
});

describe("comentários das tarefas", () => {
  async function comments() { return import("../src/actions/task-comments"); }
  it("publica texto com autor, sem alterar tarefa ou histórico automático", async () => {
    const task = await create(); const api = await comments();
    expect(await api.addTaskComment(task.id, "  Revisão concluída.\nAguardando retorno.  ")).toMatchObject({ success: true });
    const page = await api.getTaskComments(task.id);
    expect(page).toMatchObject({ success: true, total: 1, page: 1, pages: 1 });
    expect(page.comments[0]).toMatchObject({ body: "Revisão concluída.\nAguardando retorno.", authorName: "Operador" });
    expect(Object.keys(page.comments[0]).sort()).toEqual(["authorName", "body", "createdAt", "id"]);
    expect(await prisma.taskHistory.count({ where: { taskId: task.id } })).toBe(1);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: "PENDING" });
  });
  it("recusa vazios e excesso, aceita limite e trata HTML como texto", async () => {
    const task = await create(); const api = await comments();
    for (const body of ["", " \n ", "a".repeat(2001)]) expect((await api.addTaskComment(task.id, body)).success).toBe(false);
    expect((await api.addTaskComment(task.id, "a".repeat(2000))).success).toBe(true);
    expect((await api.addTaskComment(task.id, "<script>alert(1)</script>")).success).toBe(true);
    expect((await api.getTaskComments(task.id)).total).toBe(2);
  });
  it("permite conclusão e validação sem copiar comentários para a recorrência", async () => {
    const task = await create({ frequency: "MONTHLY" }); const api = await comments();
    await actions.completeTask(task.id);
    expect((await api.addTaskComment(task.id, "Após conclusão")).success).toBe(true);
    context.cookies.set("userId", "admin-test"); await actions.validateTask(task.id);
    expect((await api.addTaskComment(task.id, "Após validação")).success).toBe(true);
    const next = await prisma.task.findFirstOrThrow({ where: { sourceTaskId: task.id } });
    expect((await api.getTaskComments(next.id)).total).toBe(0);
    await actions.archiveTask(task.id, "Arquivada para teste");
    expect((await api.addTaskComment(task.id, "Proibido")).success).toBe(false);
    expect((await api.getTaskComments(task.id)).total).toBe(2);
  });
  it("visualizador lê sem publicar; outra unidade e sessão ausente não acessam", async () => {
    const task = await create(); const api = await comments(); await api.addTaskComment(task.id, "Interno");
    context.cookies.set("userId", "viewer-test");
    expect((await api.getTaskComments(task.id)).total).toBe(1);
    expect((await api.addTaskComment(task.id, "Negado")).success).toBe(false);
    for (const actor of ["other-admin", "missing"]) {
      context.cookies.set("userId", actor);
      expect(await api.getTaskComments(task.id)).toMatchObject({ success: false, comments: [], total: 0 });
      expect((await api.addTaskComment(task.id, "Negado")).success).toBe(false);
    }
    context.cookies.clear(); expect((await api.getTaskComments(task.id)).success).toBe(false);
    expect(await prisma.taskComment.count()).toBe(1);
  });
  it("pagina com ordem estável e limita páginas inválidas", async () => {
    const task = await create(); const api = await comments();
    await prisma.taskComment.createMany({ data: Array.from({ length: 22 }, (_, i) => ({ id: `comment-${String(i).padStart(2, "0")}`, body: `Mensagem ${i}`, taskId: task.id, userId: "operator-test", authorName: "Operador", createdAt: new Date("2026-11-09T12:00:00Z") })) });
    const first = await api.getTaskComments(task.id); const last = await api.getTaskComments(task.id, 999);
    expect(first).toMatchObject({ total: 22, pages: 2, page: 1 }); expect(first.comments).toHaveLength(20);
    expect(last.page).toBe(2); expect(last.comments).toHaveLength(2);
    expect(new Set([...first.comments, ...last.comments].map((item) => item.id)).size).toBe(22);
    expect((await api.getTaskComments(task.id, NaN)).page).toBe(1);
    expect((await api.getTaskComments("missing")).success).toBe(false);
  });
});

describe("central de pendências", () => {
  const now = new Date("2026-12-31T15:00:00-03:00");
  async function center(category: import("../src/lib/pending-center").PendingCategory = "all", page = 1) {
    const data = await (await import("../src/lib/pending-center")).getPendingCenterData(category, page, now);
    if (!data || data.restricted) throw new Error("Consulta indisponível");
    return data;
  }
  it("reúne prazos sem sobreposição e mostra validações somente ao gestor", async () => {
    for (const [title, dueDate] of [["Vencida", "2026-12-30T23:59:59-03:00"], ["Hoje", "2026-12-31T23:59:59-03:00"], ["Amanhã", "2027-01-01T00:00:00-03:00"], ["Dia 15", "2027-01-15T23:59:59-03:00"], ["Fora", "2027-01-16T00:00:00-03:00"]]) await prisma.task.create({ data: { title, dueDate: new Date(dueDate), unitId: "unit-test", createdById: "operator-test" } });
    await prisma.task.create({ data: { title: "Validar futura", dueDate: new Date("2027-05-01T12:00:00Z"), status: "COMPLETED", unitId: "unit-test", createdById: "operator-test" } });
    for (const override of [{ status: "VALIDATED" as const }, { archivedAt: now }, { unitId: "unit-other" }]) await prisma.task.create({ data: { title: "Oculta", dueDate: now, unitId: "unit-test", createdById: "operator-test", ...override } });
    expect((await center()).counts.map((group) => [group.id, group.count])).toEqual([["all", 4], ["overdue", 1], ["today", 1], ["upcoming", 2]]);
    expect((await center("upcoming")).tasks.map((task) => task.title)).toEqual(["Amanhã", "Dia 15"]);
    context.cookies.set("userId", "admin-test");
    const adminData = await center(); expect(adminData.total).toBe(5); expect(adminData.counts.at(-1)).toMatchObject({ id: "validation", count: 1 });
    expect((await center("validation")).tasks.map((task) => task.title)).toEqual(["Validar futura"]);
  });
  it("restringe validações e diretório de edição e exige sessão", async () => {
    await create({ dueDate: "2026-12-30" }); context.cookies.set("userId", "viewer-test");
    const data = await center(); expect(data.total).toBe(1); expect(data.employees).toEqual([]); expect(data.counts.some((group) => group.id === "validation")).toBe(false);
    const api = await import("../src/lib/pending-center");
    expect(await api.getPendingCenterData("validation", 1, now)).toEqual({ restricted: true });
    context.cookies.clear(); expect(await api.getPendingCenterData("all", 1, now)).toBeNull();
  });
  it("pagina com ordem estável e atualiza depois de concluir ou arquivar", async () => {
    await prisma.task.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ id: `pending-${String(i).padStart(2, "0")}`, title: `Pendência ${i}`, dueDate: now, unitId: "unit-test", createdById: "operator-test" })) });
    const first = await center("today"); const last = await center("today", 9999);
    expect(first.tasks).toHaveLength(25); expect(last.tasks).toHaveLength(1); expect(last.page).toBe(2);
    expect(new Set([...first.tasks, ...last.tasks].map((task) => task.id)).size).toBe(26);
    await actions.completeTask(first.tasks[0].id); expect((await center()).total).toBe(25);
    expect(context.revalidate).toHaveBeenCalledWith("/pendencias");
    context.cookies.set("userId", "admin-test"); expect((await center("validation")).total).toBe(1);
    await actions.archiveTask(first.tasks[0].id, "Arquivada no teste"); expect((await center("validation")).total).toBe(0);
  });
});
