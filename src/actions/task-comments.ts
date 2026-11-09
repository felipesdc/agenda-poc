"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canWriteTasks } from "@/lib/permissions";

const bodySchema = z.string().trim().min(1).max(2000);
const PAGE_SIZE = 20;
export type CommentItem = { id: string; body: string; authorName: string; createdAt: Date };
export type CommentPage = { success: boolean; message: string; comments: CommentItem[]; total: number; page: number; pages: number };

export async function getTaskComments(taskId: string, requestedPage = 1): Promise<CommentPage> {
  const empty: CommentPage = { success: false, message: "Não foi possível consultar os comentários desta tarefa.", comments: [], total: 0, page: 1, pages: 1 };
  try {
    const user = await getCurrentUser();
    if (!user) return empty;
    const task = await prisma.task.findFirst({ where: { id: taskId, unitId: user.unitId }, select: { id: true } });
    if (!task) return empty;
    const total = await prisma.taskComment.count({ where: { taskId } });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(pages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
    const comments = await prisma.taskComment.findMany({ where: { taskId }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, body: true, authorName: true, createdAt: true } });
    return { success: true, message: "", comments, total, page, pages };
  } catch { return empty; }
}

export async function addTaskComment(taskId: string, body: string): Promise<{ success: boolean; message: string }> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { success: false, message: "Escreva um comentário de 1 a 2.000 caracteres." };
  try {
    const user = await getCurrentUser();
    if (!user || !canWriteTasks(user)) return { success: false, message: "Seu perfil não permite adicionar comentários." };
    const success = await prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, unitId: user.unitId, archivedAt: null }, select: { id: true } });
      if (!task) return false;
      await tx.taskComment.create({ data: { taskId, userId: user.id, authorName: user.name, body: parsed.data } });
      return true;
    });
    return success ? { success: true, message: "Comentário publicado." } : { success: false, message: "Tarefa indisponível para comentários." };
  } catch { return { success: false, message: "Não foi possível publicar. Tente novamente." }; }
}
