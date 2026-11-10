"use server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canonicalFilterUrl, MAX_SAVED_FILTERS } from "@/lib/saved-task-filters";

export type AccountFilter = { id: string; name: string; href: string };
export async function getSavedTaskFilters(): Promise<{ success: boolean; items: AccountFilter[] }> {
  try {
    const user = await getCurrentUser(); if (!user) return { success: false, items: [] };
    const items = await prisma.savedTaskFilter.findMany({ where: { userId: user.id, unitId: user.unitId }, orderBy: [{ nameKey: "asc" }, { id: "asc" }], select: { id: true, name: true, href: true } });
    return { success: true, items: items.filter((item) => canonicalFilterUrl(item.href) === item.href) };
  } catch { return { success: false, items: [] }; }
}
export async function addAccountFilter(name: string, href: string) {
  if (typeof name !== "string" || typeof href !== "string") return { success: false, message: "Dados inválidos." };
  name = name.trim(); const canonical = canonicalFilterUrl(href);
  if (!name || name.length > 50 || canonical === null) return { success: false, message: "Informe um nome válido e aplique filtros válidos." };
  try {
    const user = await getCurrentUser(); if (!user) return { success: false, message: "Identifique-se para continuar." };
    await prisma.$transaction(async (tx) => {
      if (await tx.savedTaskFilter.count({ where: { userId: user.id, unitId: user.unitId } }) >= MAX_SAVED_FILTERS) throw new Error("Você já tem 10 favoritos. Remova um para salvar outro.");
      await tx.savedTaskFilter.create({ data: { userId: user.id, unitId: user.unitId, name, nameKey: name.toLocaleLowerCase("pt-BR"), href: canonical } });
    });
    return { success: true, message: "Favorito salvo." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, message: "Já existe um favorito com esse nome." };
    if (error instanceof Error && error.message.startsWith("Você já tem")) return { success: false, message: error.message };
    return { success: false, message: "Não foi possível salvar o favorito." };
  }
}
export async function removeAccountFilter(id: string) {
  if (typeof id !== "string") return { success: false, message: "Favorito inválido." };
  try {
    const user = await getCurrentUser(); if (!user) return { success: false, message: "Identifique-se para continuar." };
    const result = await prisma.savedTaskFilter.deleteMany({ where: { id, userId: user.id, unitId: user.unitId } });
    return result.count ? { success: true, message: "Favorito removido." } : { success: false, message: "Favorito indisponível." };
  } catch { return { success: false, message: "Não foi possível remover o favorito." }; }
}
