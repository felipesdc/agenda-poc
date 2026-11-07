import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { prisma } from "../src/lib/prisma";
import { provisionPassword } from "../src/lib/provision-user";

async function readPassword() {
  if (!process.stdin.isTTY) return readFileSync(0, "utf8").replace(/\r?\n$/, "");
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write("Nova senha (12 a 128 caracteres): ");
    muted = true;
    const password = await terminal.question("");
    process.stdout.write("\nConfirme a senha: ");
    const confirmation = await terminal.question("");
    process.stdout.write("\n");
    if (password !== confirmation) throw new Error("As senhas não coincidem.");
    return password;
  } finally { terminal.close(); }
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" } } });
  if (!values.email) throw new Error("Use npm run auth:provision -- --email usuario@dominio.com");
  const password = await readPassword();
  await provisionPassword(prisma, values.email, password);
  console.log("Acesso provisionado. Sessões anteriores deste usuário foram revogadas.");
}

main().catch((error: unknown) => {
  // Não imprimir objetos de erro do banco: podem conter a senha ou seu hash.
  console.error(error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Não foi possível provisionar o acesso.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
