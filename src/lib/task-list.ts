import type { Prisma } from "@prisma/client";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";
import { TASK_LIST_PAGE_SIZE, type TaskListFilters } from "./task-list-params";

export async function getTaskListData(filters: TaskListFilters) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { currentUser: null, tasks: [], employees: [], total: 0, page: 1, pages: 1 };
  const where: Prisma.TaskWhereInput = {
    unitId: currentUser.unitId, archivedAt: null,
    ...(filters.overdue ? { status: "PENDING", dueDate: { lt: startOfDay(new Date()) } }
      : filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.q ? { OR: [{ title: { contains: filters.q } }, { description: { contains: filters.q } }] } : {}),
  };
  const total = await prisma.task.count({ where });
  const pages = Math.max(1, Math.ceil(total / TASK_LIST_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pages);
  const [tasks, employees] = await Promise.all([
    prisma.task.findMany({ where, skip: (page - 1) * TASK_LIST_PAGE_SIZE, take: TASK_LIST_PAGE_SIZE,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      include: { archivedBy: { select: { name: true } }, history: { include: { user: true }, orderBy: { timestamp: "desc" } }, focalPoints: true },
    }),
    canWriteTasks(currentUser) ? prisma.employee.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return { currentUser, tasks, employees, total, page, pages };
}
