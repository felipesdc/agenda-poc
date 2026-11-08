import { getPasswordAuth, isPasswordAuthConfigured } from "./password-auth";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

// A demonstração só está disponível sem autenticação real configurada.
export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true" && !process.env.BETTER_AUTH_SECRET;
}

// Sessões reais são verificadas pelo provedor; o cookie de demonstração fica isolado.
export async function getCurrentUser(): Promise<User | null> {
  if (process.env.BETTER_AUTH_SECRET) {
    if (!isPasswordAuthConfigured()) return null;
    const session = await getPasswordAuth().api.getSession({ headers: await headers() });
    if (!session) return null;
    // O perfil e a unidade vêm do diretório atual, nunca do cookie ou de dados do cliente.
    return prisma.user.findFirst({ where: { id: session.user.id, isActive: true } });
  }
  if (!isDemoModeEnabled()) return null;
  const cookieStore = await cookies(); // Next.js 15 exige await
  const userId = cookieStore.get("userId")?.value;

  if (!userId) return null;

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
    });
    return user;
  } catch {
    return null;
  }
}
