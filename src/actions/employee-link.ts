"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

class LinkError extends Error {}

export async function setEmployeeLink(userId: string, employeeId: number | null) {
  if (typeof userId !== "string" || (employeeId !== null && (!Number.isInteger(employeeId) || employeeId < 1 || employeeId > 2147483647))) return { success: false, message: "Vínculo inválido." };
  try {
    const session = await getCurrentUser();
    if (!session) return { success: false, message: "Identifique-se para continuar." };
    await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({ where: { id: session.id, isActive: true, role: "ADMIN" } });
      if (!actor) throw new LinkError("Acesso exclusivo do gestor.");
      const user = await tx.user.findFirst({ where: { id: userId, unitId: actor.unitId } });
      if (!user) throw new LinkError("Usuário indisponível nesta unidade.");
      const before = await tx.userEmployeeLink.findUnique({ where: { userId } });
      if (employeeId === before?.employeeId || (!employeeId && !before)) return;
      if (employeeId !== null) {
        const employee = await tx.employee.findFirst({ where: { id: employeeId, tasks: { some: { unitId: actor.unitId } } }, select: { id: true } });
        if (!employee) throw new LinkError("Ponto focal indisponível nesta unidade.");
        const used = await tx.userEmployeeLink.findUnique({ where: { employeeId } });
        if (used && used.userId !== userId) throw new LinkError("Não foi possível vincular este ponto focal.");
        await tx.userEmployeeLink.upsert({ where: { userId }, create: { userId, employeeId }, update: { employeeId } });
      } else await tx.userEmployeeLink.deleteMany({ where: { userId } });
      await tx.userAudit.create({ data: { unitId: actor.unitId, actorId: actor.id, actorName: actor.name, userId, userEmail: user.email, action: "EMPLOYEE_LINK", nameBefore: user.name, nameAfter: user.name, roleBefore: user.role, roleAfter: user.role, activeBefore: user.isActive, activeAfter: user.isActive, employeeBefore: before?.employeeId ?? null, employeeAfter: employeeId } });
    });
    revalidatePath("/usuarios"); revalidatePath("/meu-dia");
    return { success: true, message: "Vínculo atualizado." };
  } catch (error) { return { success: false, message: error instanceof LinkError ? error.message : "Não foi possível atualizar o vínculo." }; }
}
