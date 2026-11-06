import type { Prisma } from "@prisma/client";

// A falha precisa chegar à transação para impedir alterações sem auditoria.
export async function logTaskHistory(
  transaction: Prisma.TransactionClient,
  taskId: string,
  userId: string,
  action: string,
  detail?: string
) {
  await transaction.taskHistory.create({ data: { taskId, userId, action, detail } });
}
