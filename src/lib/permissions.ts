import type { User } from "@prisma/client";

type Actor = Pick<User, "role" | "unitId">;
type TaskScope = { unitId: string; status: string; archivedAt: Date | null };

export function canWriteTasks(user: Actor | null): boolean {
  return user?.role === "ADMIN" || user?.role === "OPERATOR";
}

export function canManageTasks(user: Actor | null): boolean {
  return user?.role === "ADMIN";
}

export function canEditTask(user: Actor | null, task: TaskScope): boolean {
  return canWriteTasks(user) && user?.unitId === task.unitId && task.archivedAt === null && task.status === "PENDING";
}

export function canValidateTask(user: Actor | null, task: TaskScope): boolean {
  return canManageTasks(user) && user?.unitId === task.unitId && task.archivedAt === null && task.status === "COMPLETED";
}

export function canArchiveTask(user: Actor | null, task: TaskScope): boolean {
  return canManageTasks(user) && user?.unitId === task.unitId && task.archivedAt === null;
}

export function canRestoreTask(user: Actor | null, task: TaskScope): boolean {
  return canManageTasks(user) && user?.unitId === task.unitId && task.archivedAt !== null;
}
