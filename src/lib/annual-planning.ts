import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const ANNUAL_PLAN_PAGE_SIZE = 25;
export type PlanSearch = { sourceYear: number; targetYear: number; author: string; page: number };
const validYear = (value: unknown, fallback: number) => typeof value === "string" && /^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 2100 ? Number(value) : fallback;
export function resolveAnnualPlanParams(params: Record<string, string | string[] | undefined>, now = new Date()): PlanSearch {
  const currentYear = Math.min(2100, Math.max(1900, now.getFullYear()));
  const page = typeof params.page === "string" && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  return { sourceYear: validYear(params.sourceYear, Math.max(1900, currentYear - 1)), targetYear: validYear(params.targetYear, currentYear), author: typeof params.author === "string" && params.author.length <= 100 ? params.author : "", page: Number.isSafeInteger(page) ? Math.min(page, 100000) : 1 };
}
export function annualPlanUrl(params: PlanSearch, page = params.page) {
  const query = new URLSearchParams({ sourceYear: String(params.sourceYear), targetYear: String(params.targetYear) });
  if (params.author) query.set("author", params.author);
  if (page > 1) query.set("page", String(page));
  return `/planejamento-anual?${query}`;
}
export function sourceTaskWhere(unitId: string, sourceYear: number, author: string): Prisma.TaskWhereInput {
  return { unitId, status: { in: ["COMPLETED", "VALIDATED"] }, completedAt: { gte: new Date(sourceYear, 0, 1), lt: new Date(sourceYear + 1, 0, 1) }, ...(author ? { history: { some: { action: "COMPLETE", userId: author } } } : {}) };
}
export async function getAnnualPlanData(params: PlanSearch) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  const where = sourceTaskWhere(currentUser.unitId, params.sourceYear, params.author);
  const [total, authors] = await Promise.all([
    prisma.task.count({ where }),
    prisma.user.findMany({ where: { unitId: currentUser.unitId }, select: { id: true, name: true, isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ANNUAL_PLAN_PAGE_SIZE));
  const page = Math.min(Math.max(1, params.page), pages);
  const tasks = await prisma.task.findMany({ where, skip: (page - 1) * ANNUAL_PLAN_PAGE_SIZE, take: ANNUAL_PLAN_PAGE_SIZE,
    orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    select: { id: true, title: true, description: true, dueDate: true, completedAt: true, frequency: true, status: true, archivedAt: true,
      focalPoints: { select: { id: true, name: true } },
      history: { where: { action: "COMPLETE" }, select: { user: { select: { name: true } } }, orderBy: [{ timestamp: "desc" }, { id: "desc" }], take: 1 },
      nextTask: { select: { dueDate: true } },
    },
  });
  const prior = await prisma.annualPlanItem.findMany({ where: { sourceTaskId: { in: tasks.map((task) => task.id) }, targetYear: params.targetYear, batch: { unitId: currentUser.unitId } }, select: { sourceTaskId: true } });
  const previouslyPlanned = new Set(prior.map((item) => item.sourceTaskId));
  return { currentUser, authors, total, pages, page, tasks: tasks.map(({ nextTask, history, ...task }) => ({ ...task, authorName: history[0]?.user.name ?? "Não registrado", previouslyPlanned: previouslyPlanned.has(task.id), recurrenceInTargetYear: !!nextTask && new Date(nextTask.dueDate).getFullYear() === params.targetYear })) };
}
