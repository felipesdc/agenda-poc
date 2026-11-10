import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";

export async function getAgendaData(rangeStart: Date, rangeEnd: Date, archived = false) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { currentUser: null, tasks: [], employees: [] };
  const [tasks, employees] = await Promise.all([
    prisma.task.findMany({
      where: {
        unitId: currentUser.unitId,
        archivedAt: archived ? { not: null } : null,
        ...(archived ? {} : { dueDate: { gte: rangeStart, lte: rangeEnd } }),
      },
      include: { _count: { select: { comments: true } }, archivedBy: { select: { name: true } }, history: { include: { user: true }, orderBy: { timestamp: "desc" } }, focalPoints: true },
      orderBy: archived ? { archivedAt: "desc" } : { dueDate: "asc" },
    }),
    // Employee é um cadastro global; visualizadores não recebem o diretório para edição.
    !archived && canWriteTasks(currentUser) ? prisma.employee.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return { currentUser, tasks, employees };
}
