import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
    // As migrações atuais só contêm DDL e comandos sem ';' dentro de strings.
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
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
