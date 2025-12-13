import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { User } from "@prisma/client";

// Simula uma sessão buscando o ID no cookie
export async function getCurrentUser(): Promise<User | null> {
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
