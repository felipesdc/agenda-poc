"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type ChecklistItem = { id: string; title: string; done: boolean };
export async function getChecklist(taskId: string): Promise<{ success: boolean; items: ChecklistItem[] }> {
  try {
    const user = await getCurrentUser();
    if (!user || typeof taskId !== "string") return { success: false, items: [] };
    const task = await prisma.task.findFirst({ where: { id: taskId, unitId: user.unitId }, select: { id: true } });
    if (!task) return { success: false, items: [] };
    const items = await prisma.taskChecklistItem.findMany({ where: { taskId }, select: { id: true, title: true, done: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return { success: true, items };
  } catch { return { success: false, items: [] }; }
}
export async function changeChecklist(taskId: string, change: { operation: "add"; title: string } | { operation: "toggle"; id: string; done: boolean } | { operation: "remove"; id: string }) {
  if (typeof taskId !== "string" || !change || typeof change !== "object") return { success: false, message: "Dados inválidos." };
  if (change.operation === "add" && (typeof change.title !== "string" || !change.title.trim() || change.title.trim().length > 200)) return { success: false, message: "Informe uma etapa de 1 a 200 caracteres." };
  if (change.operation === "toggle" && (typeof change.id !== "string" || typeof change.done !== "boolean")) return { success: false, message: "Dados inválidos." };
  if (change.operation === "remove" && typeof change.id !== "string") return { success: false, message: "Dados inválidos." };
  if (!["add", "toggle", "remove"].includes(change.operation)) return { success: false, message: "Dados inválidos." };
  try {
    const user = await getCurrentUser();
    if (!user || !canWriteTasks(user)) return { success: false, message: "Seu perfil não permite editar etapas." };
    const success = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, unitId: user.unitId, archivedAt: null, status: "PENDING" }, select: { id: true } });
      if (!task) return false;
      if (change.operation === "add") {
        if (await tx.taskChecklistItem.count({ where: { taskId } }) >= 100) throw new Error("Limite de 100 etapas atingido.");
        await tx.taskChecklistItem.create({ data: { taskId, title: change.title.trim() } });
      } else if (change.operation === "toggle") {
        if ((await tx.taskChecklistItem.updateMany({ where: { id: change.id, taskId }, data: { done: change.done } })).count !== 1) return false;
      } else if ((await tx.taskChecklistItem.deleteMany({ where: { id: change.id, taskId } })).count !== 1) return false;
      return true;
    });
    if (!success) return { success: false, message: "Etapa ou tarefa indisponível para edição." };
    revalidatePath("/"); revalidatePath("/tarefas"); revalidatePath("/meu-dia"); revalidatePath("/pendencias");
    return { success: true, message: "Etapas atualizadas." };
  } catch (error) { return { success: false, message: error instanceof Error && error.message === "Limite de 100 etapas atingido." ? error.message : "Não foi possível atualizar as etapas." }; }
}
