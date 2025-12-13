// lib/audit.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function logTaskHistory(
  taskId: string,
  userId: string,
  action: string,
  detail?: string
) {
  try {
    // Note o H maiúsculo em taskHistory se o model for TaskHistory
    await prisma.taskHistory.create({
      data: {
        taskId,
        userId,
        action,
        detail,
      },
    });
  } catch (error) {
    console.error("Falha ao gravar auditoria:", error);
  }
}
