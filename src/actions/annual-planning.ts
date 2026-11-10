"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";
import { logTaskHistory } from "@/lib/audit";
import { sourceTaskWhere } from "@/lib/annual-planning";

const schema = z.object({
  requestId: z.uuid(), sourceYear: z.number().int().min(1900).max(2100), targetYear: z.number().int().min(1900).max(2100),
  author: z.string().max(100),
  items: z.array(z.object({ id: z.string().min(1).max(100), dueDate: z.iso.date() })).min(1).max(25),
}).superRefine((data, ctx) => {
  if (new Set(data.items.map((item) => item.id)).size !== data.items.length) ctx.addIssue({ code: "custom", message: "Uma tarefa não pode aparecer duas vezes no lote." });
  if (data.items.some((item) => !item.dueDate.startsWith(`${data.targetYear}-`))) ctx.addIssue({ code: "custom", message: "Os prazos devem pertencer ao ano de destino." });
});
type PlanResult = { success: boolean; message: string; count?: number; replay?: boolean };
class PlanError extends Error {}
export async function createAnnualPlan(input: unknown): Promise<PlanResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message || "Revise as tarefas e os prazos." };
  const data = parsed.data;
  const items = [...data.items].sort((a, b) => a.id.localeCompare(b.id));
  const payloadHash = createHash("sha256").update(JSON.stringify({ sourceYear: data.sourceYear, targetYear: data.targetYear, author: data.author, items })).digest("hex");
  try {
    const user = await getCurrentUser();
    if (!user || !canWriteTasks(user)) return { success: false, message: "Seu perfil não permite criar tarefas." };
    const result = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: user.id, unitId: user.unitId, isActive: true } });
      if (!actor || !canWriteTasks(actor)) throw new PlanError("Seu perfil não permite criar tarefas.");
      const existing = await tx.annualPlanBatch.findUnique({ where: { userId_requestId: { userId: actor.id, requestId: data.requestId } }, include: { _count: { select: { items: true } } } });
      if (existing) {
        if (existing.unitId !== actor.unitId || existing.payloadHash !== payloadHash) throw new PlanError("Esta solicitação já foi usada com outros dados. Atualize a página.");
        return { count: existing._count.items, replay: true };
      }
      const sources = await tx.task.findMany({ where: { ...sourceTaskWhere(actor.unitId, data.sourceYear, data.author), id: { in: items.map((item) => item.id) } }, include: { focalPoints: { select: { id: true } } } });
      if (sources.length !== items.length) throw new PlanError("Uma ou mais tarefas deixaram de corresponder à consulta. Atualize a página.");
      const batch = await tx.annualPlanBatch.create({ data: { userId: actor.id, unitId: actor.unitId, requestId: data.requestId, payloadHash, sourceYear: data.sourceYear, targetYear: data.targetYear } });
      for (const item of items) {
        const source = sources.find((task) => task.id === item.id)!;
        const task = await tx.task.create({ data: { title: source.title, description: source.description, dueDate: new Date(`${item.dueDate}T12:00:00Z`), frequency: source.frequency, unitId: actor.unitId, createdById: actor.id, focalPoints: { connect: source.focalPoints.map(({ id }) => ({ id })) } } });
        await logTaskHistory(tx, task.id, actor.id, "CREATE", `Criada pelo planejamento anual a partir da tarefa ${source.id} (${data.sourceYear}).`);
        await tx.annualPlanItem.create({ data: { batchId: batch.id, sourceTaskId: source.id, targetTaskId: task.id, targetYear: data.targetYear } });
      }
      return { count: items.length, replay: false };
    });
    for (const path of ["/", "/tarefas", "/meu-dia", "/pendencias", "/resumo", "/planejamento-anual"]) revalidatePath(path);
    return { success: true, message: result.replay ? "Este lote já foi criado anteriormente." : `${result.count} tarefa(s) criada(s) com sucesso.`, ...result };
  } catch (error) {
    if (error instanceof PlanError) return { success: false, message: error.message };
    return { success: false, message: "Não foi possível criar o lote. Tente novamente com os mesmos dados." };
  }
}
