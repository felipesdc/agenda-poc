import type { Employee, User } from "@prisma/client";
import type { TaskWithHistory } from "../../src/components/TaskModal";

export const employees: Employee[] = [
  { id: 1001, name: "Alice Gestora", email: "alice@test.invalid" },
  { id: 1002, name: "Bob Operador", email: "bob@test.invalid" },
];
export const operator: User = { id: "operator", name: "Bob Operador", email: "bob@test.invalid", role: "OPERATOR", unitId: "unit" };
export const admin: User = { ...operator, id: "admin", name: "Alice Gestora", role: "ADMIN" };

export function taskFixture(overrides: Partial<TaskWithHistory> = {}): TaskWithHistory {
  return {
    id: "task", sourceTaskId: null, archivedAt: null, archivedById: null, archiveReason: null, title: "Enviar remessa", description: "Conferir os documentos",
    dueDate: new Date("2026-11-05T12:00:00Z"), status: "PENDING", frequency: "NONE",
    createdAt: new Date("2026-11-01T12:00:00Z"), completedAt: null, validatedAt: null,
    createdById: operator.id, unitId: operator.unitId, focalPoints: [employees[0]],
    history: [{ id: "history", taskId: "task", userId: operator.id, action: "CREATE", detail: "Tarefa criada", timestamp: new Date("2026-11-01T12:00:00Z"), user: operator }],
    ...overrides,
  };
}
