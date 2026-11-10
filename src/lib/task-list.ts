import { normalizeSearchText } from "./search-text";
import type { Prisma } from "@prisma/client";
import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";
import { TASK_LIST_PAGE_SIZE, type TaskListFilters } from "./task-list-params";

export async function getTaskListData(filters: TaskListFilters) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { currentUser: null, tasks: [], employees: [], total: 0, page: 1, pages: 1, focalOptions: [] };
  // Só nomes/matrículas já associados a tarefas ativas da unidade são opções de consulta.
  // O diretório completo continua restrito a quem pode editar.
  const focalOptions = await prisma.employee.findMany({
    where: { tasks: { some: { unitId: currentUser.unitId, archivedAt: null } } },
    select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  if (filters.errors.length) return { currentUser, tasks: [], employees: [], total: 0, page: 1, pages: 1, focalOptions };
  const where = taskListWhere(filters, currentUser.unitId);
  const total = await prisma.task.count({ where });
  const pages = Math.max(1, Math.ceil(total / TASK_LIST_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pages);
  const [tasks, employees] = await Promise.all([
    prisma.task.findMany({ where, skip: (page - 1) * TASK_LIST_PAGE_SIZE, take: TASK_LIST_PAGE_SIZE,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      include: { _count: { select: { comments: true } }, archivedBy: { select: { name: true } }, history: { include: { user: true }, orderBy: { timestamp: "desc" } }, focalPoints: true },
    }),
    canWriteTasks(currentUser) ? prisma.employee.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return { currentUser, tasks, employees, total, page, pages, focalOptions };
}

export function taskListWhere(filters: TaskListFilters, unitId: string): Prisma.TaskWhereInput {
  return {
    unitId, archivedAt: null,
    ...(filters.overdue ? { status: "PENDING" } : filters.status !== "ALL" ? { status: filters.status } : {}),
    ...((filters.overdue || filters.from || filters.to) ? { dueDate: {
      ...(filters.overdue ? { lt: startOfDay(new Date()) } : {}),
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
      ...(filters.to ? { lte: endOfDay(new Date(`${filters.to}T00:00:00`)) } : {}),
    } } : {}),
    ...(filters.focalPoint !== null ? { focalPoints: { some: { id: filters.focalPoint } } } : {}),
    ...(filters.q ? { searchText: { contains: normalizeSearchText(filters.q) } } : {}),
  };
}
