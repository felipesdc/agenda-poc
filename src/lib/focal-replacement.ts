import { createHash } from "node:crypto";
import { startOfDay } from "date-fns";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canWriteTasks } from "@/lib/permissions";

export const FOCAL_REPLACEMENT_LIMIT = 200;
type Database = PrismaClient | Prisma.TransactionClient;
export type FocalReplacementPreview = {
  source: { id: number; name: string }; destination: { id: number; name: string };
  total: number; digest: string; from: string;
  tasks: { id: string; title: string; dueDate: Date; focalPoints: { id: number; name: string }[] }[];
};
export async function getFocalReplacementOptions() {
  const actor = await getCurrentUser();
  if (!actor || !canWriteTasks(actor)) return null;
  const [sources, destinations] = await Promise.all([
    prisma.employee.findMany({ where: { tasks: { some: { unitId: actor.unitId, archivedAt: null, status: "PENDING", dueDate: { gte: startOfDay(new Date()) } } } }, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.employee.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);
  return { sources, destinations };
}
export async function buildFocalReplacementPreview(db: Database, unitId: string, sourceId: number, destinationId: number, now = new Date()): Promise<FocalReplacementPreview | null> {
  if (!Number.isInteger(sourceId) || sourceId < 1 || sourceId > 2147483647 || !Number.isInteger(destinationId) || destinationId < 1 || destinationId > 2147483647 || sourceId === destinationId) return null;
  const from = startOfDay(now);
  const where: Prisma.TaskWhereInput = { unitId, archivedAt: null, status: "PENDING", dueDate: { gte: from }, focalPoints: { some: { id: sourceId } } };
  const [source, destination, total, tasks] = await Promise.all([
    db.employee.findUnique({ where: { id: sourceId }, select: { id: true, name: true } }),
    db.employee.findUnique({ where: { id: destinationId }, select: { id: true, name: true } }),
    db.task.count({ where }),
    db.task.findMany({ where, take: FOCAL_REPLACEMENT_LIMIT, orderBy: [{ dueDate: "asc" }, { id: "asc" }], select: { id: true, title: true, dueDate: true, focalPoints: { select: { id: true, name: true }, orderBy: { id: "asc" } } } }),
  ]);
  if (!source || !destination) return null;
  const snapshot = { unitId, source, destination, from: from.toISOString(), total, tasks: tasks.map((task) => ({ ...task, dueDate: task.dueDate.toISOString() })) };
  const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return { source, destination, total, tasks, digest, from: from.toISOString() };
}
