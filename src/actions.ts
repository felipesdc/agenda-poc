"use server";

import type { Prisma, User } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logTaskHistory } from "@/lib/audit";
import { calculateNextDueDate } from "@/lib/frequency";
import { getCurrentUser, isDemoModeEnabled } from "@/lib/auth";
import { canManageTasks, canWriteTasks } from "@/lib/permissions";
import { archiveReasonSchema } from "@/lib/archive-input";
import { parseTaskFormData, type TaskFieldErrors } from "@/lib/task-input";

export type FormState = { errors?: TaskFieldErrors; message: string; success?: boolean };

class TaskActionError extends Error {
  constructor(message: string, readonly errors?: TaskFieldErrors) { super(message); }
}

async function mutate(
  permission: "write" | "admin",
  operation: (tx: Prisma.TransactionClient, user: User) => Promise<string>
): Promise<FormState> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new TaskActionError("Você precisa estar logado.");
    if (!(permission === "admin" ? canManageTasks(user) : canWriteTasks(user))) {
      throw new TaskActionError("Acesso negado para este perfil.");
    }
    const message = await prisma.$transaction((tx) => operation(tx, user));
    revalidatePath("/");
    revalidatePath("/tarefas");
    revalidatePath("/validacoes");
    return { success: true, message, errors: {} };
  } catch (error) {
    if (error instanceof TaskActionError) return { success: false, message: error.message, errors: error.errors };
    console.error("Falha na operação de tarefa:", error);
    return { success: false, message: "Não foi possível salvar a alteração. Tente novamente." };
  }
}

async function checkFocalPoints(tx: Prisma.TransactionClient, ids: number[]) {
  const count = await tx.employee.count({ where: { id: { in: ids } } });
  if (count !== ids.length) {
    throw new TaskActionError("Revise os pontos focais selecionados.", {
      focalPoints: ["Um ou mais funcionários não foram encontrados."],
    });
  }
}

export async function createTask(previous: FormState, formData: FormData): Promise<FormState> {
  const fields = parseTaskFormData(formData);
  if (!fields.success) return { success: false, message: "Erro na validação dos campos.", errors: fields.error.flatten().fieldErrors };
  return mutate("write", async (tx, user) => {
    const { title, description, dueDate, frequency, focalPoints } = fields.data;
    await checkFocalPoints(tx, focalPoints);
    const task = await tx.task.create({ data: {
      title, description: description || "", dueDate: new Date(`${dueDate}T12:00:00Z`), frequency,
      createdById: user.id, unitId: user.unitId,
      focalPoints: { connect: focalPoints.map((id) => ({ id })) },
    } });
    await logTaskHistory(tx, task.id, user.id, "CREATE", "Tarefa criada");
    return "Tarefa criada com sucesso!";
  });
}

export async function updateTask(taskId: string, previous: FormState, formData: FormData): Promise<FormState> {
  const fields = parseTaskFormData(formData);
  if (!fields.success) return { success: false, message: "Erro na validação dos campos.", errors: fields.error.flatten().fieldErrors };
  return mutate("write", async (tx, user) => {
    const { title, description, dueDate, frequency, focalPoints } = fields.data;
    const date = new Date(`${dueDate}T12:00:00Z`);
    const old = await tx.task.findFirst({ where: { id: taskId, unitId: user.unitId }, include: { focalPoints: true } });
    if (!old) throw new TaskActionError("Tarefa não encontrada");
    if (old.archivedAt !== null || old.status !== "PENDING") throw new TaskActionError("Apenas tarefas pendentes e ativas podem ser editadas.");
    await checkFocalPoints(tx, focalPoints);
    const changed = await tx.task.updateMany({
      where: { id: taskId, unitId: user.unitId, archivedAt: null, status: "PENDING" },
      data: { title, description: description || "", dueDate: date, frequency },
    });
    if (changed.count !== 1) throw new TaskActionError("A tarefa foi alterada. Atualize a página.");
    await tx.task.update({ where: { id: taskId }, data: { focalPoints: { set: focalPoints.map((id) => ({ id })) } } });
    const changes: [string, unknown, unknown][] = [
      ["Título", old.title, title], ["Prazo", old.dueDate.toISOString(), date.toISOString()],
      ["Periodicidade", old.frequency, frequency], ["Descrição", old.description || "", description || ""],
      ["Pontos focais", old.focalPoints.map((item) => item.id).sort((a, b) => a - b), [...focalPoints].sort((a, b) => a - b)],
    ];
    for (const [field, before, after] of changes) {
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await logTaskHistory(tx, taskId, user.id, "UPDATE", `${field}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
      }
    }
    return "Tarefa atualizada com sucesso!";
  });
}

export async function archiveTask(taskId: string, reason: string): Promise<FormState> {
  const validated = archiveReasonSchema.safeParse(reason);
  if (!validated.success) return { success: false, message: validated.error.issues[0].message };
  return mutate("admin", async (tx, user) => {
    const changed = await tx.task.updateMany({
      where: { id: taskId, unitId: user.unitId, archivedAt: null },
      data: { archivedAt: new Date(), archivedById: user.id, archiveReason: validated.data },
    });
    if (changed.count !== 1) throw new TaskActionError("Tarefa indisponível para arquivamento ou já arquivada.");
    await logTaskHistory(tx, taskId, user.id, "ARCHIVE", `Motivo: ${validated.data}`);
    return "Tarefa arquivada. O histórico foi preservado.";
  });
}

export async function restoreTask(taskId: string): Promise<FormState> {
  return mutate("admin", async (tx, user) => {
    const changed = await tx.task.updateMany({
      where: { id: taskId, unitId: user.unitId, archivedAt: { not: null } },
      data: { archivedAt: null, archivedById: null, archiveReason: null },
    });
    if (changed.count !== 1) throw new TaskActionError("Tarefa indisponível para restauração.");
    await logTaskHistory(tx, taskId, user.id, "RESTORE", "Tarefa restaurada; estado e prazo originais preservados");
    return "Tarefa restaurada para a agenda.";
  });
}

export async function completeTask(taskId: string): Promise<FormState> {
  return mutate("write", async (tx, user) => {
    const updated = await tx.task.updateMany({
      where: { id: taskId, unitId: user.unitId, archivedAt: null, status: "PENDING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (updated.count !== 1) throw new TaskActionError("Tarefa indisponível para conclusão.");
    await logTaskHistory(tx, taskId, user.id, "COMPLETE", "Tarefa marcada como concluída");
    return "Tarefa concluída!";
  });
}

export async function validateTask(taskId: string): Promise<FormState> {
  return mutate("admin", async (tx, user) => {
    // A primeira instrução é uma escrita condicional: duas requisições não reivindicam a mesma conclusão.
    const claimed = await tx.task.updateMany({
      where: { id: taskId, unitId: user.unitId, archivedAt: null, status: "COMPLETED" },
      data: { status: "VALIDATED", validatedAt: new Date() },
    });
    if (claimed.count !== 1) throw new TaskActionError("Tarefa indisponível para validação ou já validada.");
    const current = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: { focalPoints: true } });
    await logTaskHistory(tx, taskId, user.id, "VALIDATE", "Conclusão validada pelo gestor");
    const nextDate = calculateNextDueDate(current.dueDate, current.frequency);
    if (!nextDate) return "Tarefa validada e finalizada.";
    const next = await tx.task.create({ data: {
      title: current.title, description: current.description, dueDate: nextDate, frequency: current.frequency,
      createdById: user.id, unitId: current.unitId, sourceTaskId: current.id,
      focalPoints: { connect: current.focalPoints.map(({ id }) => ({ id })) },
    } });
    await logTaskHistory(tx, next.id, user.id, "CREATE", `Gerada automaticamente (Recorrência de ${current.title})`);
    return "Validado! Próxima tarefa gerada.";
  });
}

export async function switchUser(email: string) {
  if (!isDemoModeEnabled()) return { success: false, message: "A troca de perfil só está disponível no modo de demonstração." };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { success: false, message: "Perfil não cadastrado. Execute npm run demo:prepare no ambiente local." };
  if (!user.isActive) return { success: false, message: "Esta conta está desativada. Um gestor precisa reativá-la." };
  if (user.isActive) {
    const store = await cookies();
    store.set("userId", user.id, { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
    revalidatePath("/");
    return { success: true, message: "Perfil alterado." };
  }
}
