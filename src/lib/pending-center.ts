import { addDays, startOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";

export const pendingCategories = ["all", "overdue", "today", "upcoming", "validation"] as const;
export type PendingCategory = typeof pendingCategories[number];
export const pendingLabels: Record<PendingCategory, string> = { all: "Todas as pendências", overdue: "Vencidas", today: "Prazo hoje", upcoming: "Próximos 15 dias", validation: "Aguardando validação" };
export function resolvePendingParams(params: Record<string, string | string[] | undefined>) {
  const category: PendingCategory = pendingCategories.includes(params.category as PendingCategory) ? params.category as PendingCategory : "all";
  const value = typeof params.page === "string" ? Number(params.page) : 1;
  return { category, page: Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100000) : 1 };
}
export function pendingCenterUrl(category: PendingCategory, page = 1) {
  const query = new URLSearchParams();
  if (category !== "all") query.set("category", category);
  if (page > 1) query.set("page", String(page));
  return `/pendencias${query.size ? `?${query}` : ""}`;
}

export async function getPendingCenterData(category: PendingCategory, requestedPage: number, now = new Date()) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  // A categoria de validação não concede acesso fora do perfil de gestor.
  if (category === "validation" && currentUser.role !== "ADMIN") return { restricted: true as const };
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const conditions: Record<Exclude<PendingCategory, "all">, Prisma.TaskWhereInput> = {
    overdue: { status: "PENDING", dueDate: { lt: today } },
    today: { status: "PENDING", dueDate: { gte: today, lt: tomorrow } },
    upcoming: { status: "PENDING", dueDate: { gte: tomorrow, lt: addDays(today, 16) } },
    validation: { status: "COMPLETED" },
  };
  const available = (["overdue", "today", "upcoming", ...(currentUser.role === "ADMIN" ? ["validation"] : [])] as Exclude<PendingCategory, "all">[]);
  const scope = { unitId: currentUser.unitId, archivedAt: null };
  const counts = await Promise.all(available.map(async (id) => ({ id, label: pendingLabels[id], count: await prisma.task.count({ where: { ...scope, ...conditions[id] } }) })));
  const total = category === "all" ? counts.reduce((sum, group) => sum + group.count, 0) : counts.find((group) => group.id === category)!.count;
  const pages = Math.max(1, Math.ceil(total / 25));
  const page = Math.min(pages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const where: Prisma.TaskWhereInput = { ...scope, ...(category === "all" ? { OR: available.map((id) => conditions[id]) } : conditions[category]) };
  const [tasks, employees] = await Promise.all([
    prisma.task.findMany({ where, skip: (page - 1) * 25, take: 25, orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      include: { focalPoints: true, history: { include: { user: true }, orderBy: { timestamp: "desc" } } } }),
    canWriteTasks(currentUser) ? prisma.employee.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return { restricted: false as const, currentUser, tasks, employees, counts: [{ id: "all" as const, label: pendingLabels.all, count: counts.reduce((sum, group) => sum + group.count, 0) }, ...counts], total, pages, page, updatedAt: now };
}
