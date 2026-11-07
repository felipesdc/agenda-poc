import { createPasswordAuth } from "./auth-config";
import { prisma } from "./prisma";

let instance: ReturnType<typeof createPasswordAuth> | undefined;

export function isPasswordAuthConfigured(): boolean {
  try {
    const url = new URL(process.env.BETTER_AUTH_URL || "");
    return Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32
      && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      && (process.env.NODE_ENV !== "production" || url.protocol === "https:"));
  } catch { return false; }
}

export function getPasswordAuth() {
  if (instance) return instance;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) throw new Error("Configure BETTER_AUTH_SECRET (mínimo 32 caracteres) e BETTER_AUTH_URL.");
  const url = new URL(baseURL);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
    throw new Error("BETTER_AUTH_URL deve ser uma URL HTTP válida; em produção use HTTPS.");
  }
  instance = createPasswordAuth(prisma, { secret, baseURL: url.origin });
  return instance;
}
