import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export async function provisionPassword(database: PrismaClient, email: string, password: string) {
  const normalizedEmail = z.email().parse(email.trim().toLowerCase());
  z.string().min(12).max(128).parse(password);
  const user = await database.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new Error("Usuário não encontrado no diretório. Cadastre nome, perfil e unidade antes de provisionar o acesso.");
  const hash = await hashPassword(password);
  await database.$transaction(async (tx) => {
    await tx.authUser.upsert({
      where: { id: user.id },
      create: { id: user.id, name: user.name, email: user.email },
      update: { name: user.name, email: user.email },
    });
    await tx.authAccount.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      create: { id: randomUUID(), providerId: "credential", accountId: user.id, userId: user.id, password: hash },
      update: { password: hash },
    });
    // Reprovisionar a senha revoga todos os acessos anteriores.
    await tx.authSession.deleteMany({ where: { userId: user.id } });
  });
  return { id: user.id, email: user.email };
}
