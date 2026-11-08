import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";

export function createPasswordAuth(database: PrismaClient, config: { secret: string; baseURL: string }) {
  return betterAuth({
    appName: "Agenda da Unidade",
    secret: config.secret,
    baseURL: config.baseURL,
    database: prismaAdapter(database, { provider: "sqlite" }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    databaseHooks: {
      session: { create: { before: async (session) => {
        const user = await database.user.findFirst({ where: { id: session.userId, isActive: true }, select: { id: true } });
        if (!user) throw new APIError("UNAUTHORIZED", { message: "E-mail ou senha inválidos." });
      } } },
    },
    user: { modelName: "authUser" },
    account: { modelName: "authAccount" },
    verification: { modelName: "authVerification" },
    session: {
      modelName: "authSession",
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true, storage: "database", modelName: "authRateLimit",
      window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 10 } },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: config.baseURL.startsWith("https://"),
      // Sem um proxy confiável definido, não aceitar IPs arbitrários enviados pelo cliente.
      // Neste estágio o limite é compartilhado entre clientes para cada caminho.
      ipAddress: { ipAddressHeaders: [] },
    },
    // As identidades seguem o diretório administrativo; sem alteração pública de e-mail/nome.
    disabledPaths: ["/update-user", "/change-email", "/delete-user"],
  });
}
