import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { User } from "@prisma/client";

// Esta sessão é exclusivamente de demonstração; não é autenticação de produção.
export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
}

// Simula uma sessão buscando o ID no cookie
export async function getCurrentUser(): Promise<User | null> {
  if (!isDemoModeEnabled()) return null;
  const cookieStore = await cookies(); // Next.js 15 exige await
  const userId = cookieStore.get("userId")?.value;

  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user;
  } catch {
    return null;
  }
}
