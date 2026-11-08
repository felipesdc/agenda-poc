import type { PrismaClient } from "@prisma/client";

// Preparação explícita de dados fictícios: nunca altera perfis ou reativa contas existentes.
export async function prepareDemoProfiles(database: PrismaClient) {
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE !== "true" || process.env.BETTER_AUTH_SECRET) {
    throw new Error("Preparação disponível somente em desenvolvimento com DEMO_MODE=true e sem segredo de autenticação.");
  }
  return database.$transaction(async (tx) => {
    const existingAdmin = await tx.user.findUnique({ where: { email: "admin@banco.com" } });
    const unitId = existingAdmin?.unitId || (await tx.unit.upsert({ where: { code: "U001" }, update: {}, create: { code: "U001", name: "Agência Central" } })).id;
    for (const profile of [
      { name: "Alice Gestora", email: "admin@banco.com", role: "ADMIN" as const },
      { name: "Bob Operador", email: "operador@banco.com", role: "OPERATOR" as const },
      { name: "Carlos Leitor", email: "leitor@banco.com", role: "VIEWER" as const },
    ]) await tx.user.upsert({ where: { email: profile.email }, update: {}, create: { ...profile, unitId } });
  });
}
