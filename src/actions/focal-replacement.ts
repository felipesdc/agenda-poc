"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logTaskHistory } from "@/lib/audit";
import { buildFocalReplacementPreview, type FocalReplacementPreview } from "@/lib/focal-replacement";

export async function previewFocalReplacement(sourceId: number, destinationId: number): Promise<{ success: boolean; message: string; preview?: FocalReplacementPreview }> {
  try {
    const actor = await getCurrentUser();
    if (!actor || !canWriteTasks(actor)) return { success: false, message: "Seu perfil não permite substituir pontos focais." };
    const preview = await buildFocalReplacementPreview(prisma, actor.unitId, sourceId, destinationId);
    if (!preview) return { success: false, message: "Escolha dois pontos focais válidos e diferentes." };
    return { success: true, message: "Prévia atualizada.", preview };
  } catch { return { success: false, message: "Não foi possível carregar a prévia. Tente novamente." }; }
}
class ReplacementError extends Error {}
export async function applyFocalReplacement(sourceId: number, destinationId: number, digest: string): Promise<{ success: boolean; message: string; count?: number; remaining?: number }> {
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) return { success: false, message: "Prévia inválida. Consulte novamente." };
  try {
    const user = await getCurrentUser();
    if (!user || !canWriteTasks(user)) return { success: false, message: "Seu perfil não permite substituir pontos focais." };
    const result = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: user.id, unitId: user.unitId, isActive: true } });
      if (!actor || !canWriteTasks(actor)) throw new ReplacementError("Seu perfil não permite substituir pontos focais.");
      const preview = await buildFocalReplacementPreview(tx, actor.unitId, sourceId, destinationId);
      if (!preview || preview.digest !== digest) throw new ReplacementError("As tarefas ou os pontos focais mudaram desde a prévia. Consulte novamente antes de confirmar.");
      if (!preview.tasks.length) throw new ReplacementError("Não há tarefas elegíveis para substituir.");
      for (const task of preview.tasks) {
        const before = task.focalPoints.map((person) => person.id);
        const after = [...new Set([...before.filter((id) => id !== sourceId), destinationId])].sort((a, b) => a - b);
        const updated = await tx.task.updateMany({ where: { id: task.id, unitId: actor.unitId, archivedAt: null, status: "PENDING", dueDate: task.dueDate, focalPoints: { some: { id: sourceId } } }, data: { dueDate: task.dueDate } });
        if (updated.count !== 1) throw new ReplacementError("Uma tarefa mudou. Consulte novamente antes de confirmar.");
        await tx.task.update({ where: { id: task.id }, data: { focalPoints: { set: after.map((id) => ({ id })) } } });
        await logTaskHistory(tx, task.id, actor.id, "UPDATE", `Pontos focais: ${JSON.stringify(before)} → ${JSON.stringify(after)}. Substituição em lote: ${preview.source.name} (${sourceId}) → ${preview.destination.name} (${destinationId}).`);
      }
      return { count: preview.tasks.length, remaining: preview.total - preview.tasks.length };
    });
    for (const path of ["/", "/tarefas", "/meu-dia", "/pendencias", "/resumo", "/validacoes", "/substituir-ponto-focal"]) revalidatePath(path);
    return { success: true, message: `${result.count} tarefa(s) atualizada(s).`, ...result };
  } catch (error) {
    if (error instanceof ReplacementError) return { success: false, message: error.message };
    return { success: false, message: "Não foi possível confirmar a substituição. Atualize a prévia e confira o resultado antes de tentar novamente." };
  }
}
