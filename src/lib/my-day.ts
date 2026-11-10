import { addDays, format, startOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";

export function myDayRanges(now = new Date()): { id: string; title: string; dueDate: Prisma.DateTimeFilter; query: Record<string, string> }[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  return [
    { id: "overdue", title: "Vencidas", dueDate: { lt: today }, query: { overdue: "true" } },
    { id: "today", title: "Hoje", dueDate: { gte: today, lt: tomorrow }, query: { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") } },
    { id: "next", title: "Próximos sete dias", dueDate: { gte: tomorrow, lt: addDays(today, 8) }, query: { from: format(tomorrow, "yyyy-MM-dd"), to: format(addDays(today, 7), "yyyy-MM-dd") } },
  ];
}

export async function getMyDayData(focalPoint: number | null, now = new Date(), mine = false) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { currentUser: null, groups: [], employees: [], focalOptions: [] };
  const unitId = currentUser.unitId;
  const link = mine ? await prisma.userEmployeeLink.findUnique({ where: { userId: currentUser.id } }) : null;
  const effectiveFocal = mine ? link?.employeeId ?? null : focalPoint;
  const [groups, employees, focalOptions] = await Promise.all([
    Promise.all(myDayRanges(now).map(async (range) => {
      const where: Prisma.TaskWhereInput = { unitId, archivedAt: null, status: "PENDING", dueDate: range.dueDate,
        ...(mine && !link ? { id: { in: [] } } : effectiveFocal !== null ? { focalPoints: { some: { id: effectiveFocal } } } : {}) };
      const [total, tasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({ where, take: 25, orderBy: [{ dueDate: "asc" }, { id: "asc" }],
          include: { _count: { select: { comments: true } }, focalPoints: true, history: { include: { user: true }, orderBy: { timestamp: "desc" } } } }),
      ]);
      const query = new URLSearchParams({ status: "PENDING", ...range.query, ...(effectiveFocal !== null ? { focalPoint: String(effectiveFocal) } : {}) });
      return { id: range.id, title: range.title, total, tasks, href: `/tarefas?${query}` };
    })),
    canWriteTasks(currentUser) ? prisma.employee.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.employee.findMany({ where: { tasks: { some: { unitId, archivedAt: null } } }, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  return { currentUser, groups, employees, focalOptions, hasEmployeeLink: !mine || !!link };
}
