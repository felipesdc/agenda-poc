"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserSchema, userProfileSchema, type UserActionState } from "@/lib/user-input";

class UserManagementError extends Error {}

async function mutateUser(operation: (tx: Prisma.TransactionClient, actorId: string, unitId: string) => Promise<void>): Promise<UserActionState> {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) return { success: false, message: "Identifique-se para continuar." };
    await prisma.$transaction(async (tx) => {
      // Reconsulta o perfil dentro da transação: não confiar no formulário nem em uma leitura antiga.
      const actor = await tx.user.findUnique({ where: { id: sessionUser.id } });
      if (actor?.role !== "ADMIN" || !actor.isActive) throw new UserManagementError("Acesso exclusivo do gestor da unidade.");
      await operation(tx, actor.id, actor.unitId);
    });
    revalidatePath("/usuarios");
    revalidatePath("/");
    return { success: true, message: "Usuário salvo com sucesso." };
  } catch (error) {
    if (error instanceof UserManagementError) return { success: false, message: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "Não foi possível cadastrar este e-mail. Confira os dados ou contate o responsável pelo sistema." };
    }
    return { success: false, message: "Não foi possível salvar. Tente novamente." };
  }
}

export async function createManagedUser(form: FormData): Promise<UserActionState> {
  const parsed = createUserSchema.safeParse({ name: form.get("name"), email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { success: false, message: "Revise nome, e-mail e perfil informados." };
  return mutateUser(async (tx, actorId, unitId) => {
    // Unicidade de e-mail sem distinguir maiúsculas, inclusive para cadastros legados.
    const existing = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM User WHERE lower(email) = ${parsed.data.email} LIMIT 1`;
    if (existing.length) throw new UserManagementError("Não foi possível cadastrar este e-mail. Confira os dados ou contate o responsável pelo sistema.");
    const user = await tx.user.create({ data: { ...parsed.data, unitId } });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    await tx.userAudit.create({ data: {
      unitId, actorId, actorName: actor.name, userId: user.id, userEmail: user.email,
      action: "CREATE", nameAfter: user.name, roleAfter: user.role,
      activeAfter: user.isActive,
    } });
  });
}

export async function updateManagedUser(id: string, form: FormData): Promise<UserActionState> {
  const parsed = userProfileSchema.safeParse({ name: form.get("name"), role: form.get("role") });
  if (!parsed.success) return { success: false, message: "Revise o nome e o perfil informados." };
  return mutateUser(async (tx, actorId, unitId) => {
    if (id === actorId && parsed.data.role !== "ADMIN") {
      throw new UserManagementError("Você não pode remover o próprio perfil de gestor.");
    }
    const before = await tx.user.findFirst({ where: { id, unitId } });
    if (!before) throw new UserManagementError("Usuário indisponível nesta unidade.");
    if (before.name === parsed.data.name && before.role === parsed.data.role) return;
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    const changed = await tx.user.updateMany({ where: { id, unitId }, data: parsed.data });
    if (changed.count !== 1) throw new UserManagementError("Usuário indisponível nesta unidade.");
    await tx.authUser.updateMany({ where: { id }, data: { name: parsed.data.name } });
    // Mudanças administrativas revogam sessões; o perfil também é relido em cada acesso.
    await tx.authSession.deleteMany({ where: { userId: id } });
    await tx.userAudit.create({ data: {
      unitId, actorId, actorName: actor.name, userId: id, userEmail: before.email,
      action: "UPDATE", nameBefore: before.name, roleBefore: before.role,
      nameAfter: parsed.data.name, roleAfter: parsed.data.role,
      activeBefore: before.isActive, activeAfter: before.isActive,
    } });
  });
}

export async function setManagedUserActive(id: string, isActive: boolean): Promise<UserActionState> {
  if (typeof isActive !== "boolean") return { success: false, message: "Situação inválida." };
  return mutateUser(async (tx, actorId, unitId) => {
    if (id === actorId) throw new UserManagementError("Você não pode alterar a situação da própria conta.");
    const before = await tx.user.findFirst({ where: { id, unitId } });
    if (!before) throw new UserManagementError("Usuário indisponível nesta unidade.");
    if (before.isActive === isActive) throw new UserManagementError("A conta já está nessa situação. Atualize a página.");
    const changed = await tx.user.updateMany({ where: { id, unitId, isActive: !isActive }, data: { isActive } });
    if (changed.count !== 1) throw new UserManagementError("A conta foi alterada. Atualize a página.");
    await tx.authSession.deleteMany({ where: { userId: id } });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
    await tx.userAudit.create({ data: {
      unitId, actorId, actorName: actor.name, userId: id, userEmail: before.email,
      action: isActive ? "REACTIVATE" : "DEACTIVATE", nameBefore: before.name, nameAfter: before.name,
      roleBefore: before.role, roleAfter: before.role, activeBefore: before.isActive, activeAfter: isActive,
    } });
  });
}
