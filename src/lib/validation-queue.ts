import { normalizeSearchText } from "./search-text";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { TASK_LIST_PAGE_SIZE } from "./task-list-params";

export async function getValidationCount(): Promise<number | null> {
  const actor = await getCurrentUser();
  if (actor?.role !== "ADMIN") return null;
  return prisma.task.count({ where: { unitId: actor.unitId, archivedAt: null, status: "COMPLETED" } });
}

export async function getValidationQueue(q: string, requestedPage: number) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "ADMIN") return null;
  const query = q.trim().slice(0, 120);
  const where = { unitId: currentUser.unitId, archivedAt: null, status: "COMPLETED" as const,
    ...(query ? { searchText: { contains: normalizeSearchText(query) } } : {}),
  };
  const total = await prisma.task.count({ where });
  const pages = Math.max(1, Math.ceil(total / TASK_LIST_PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(Math.max(1, requestedPage), pages) : 1;
  const tasks = await prisma.task.findMany({ where, take: TASK_LIST_PAGE_SIZE, skip: (page - 1) * TASK_LIST_PAGE_SIZE,
    orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { id: "asc" }],
    include: { _count: { select: { comments: true } }, history: { include: { user: true }, orderBy: { timestamp: "desc" } }, focalPoints: true },
  });
  return { currentUser, tasks, total, page, pages };
}

export function validationQueueUrl(q: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/validacoes${params.size ? `?${params}` : ""}`;
}
