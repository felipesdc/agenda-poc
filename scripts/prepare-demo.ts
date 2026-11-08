import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { prepareDemoProfiles } from "../src/lib/demo-profiles";
prepareDemoProfiles(prisma).then(() => console.log("Perfis de demonstração preparados. Cadastros existentes foram preservados."))
  .catch((error: unknown) => {
    console.error(error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Não foi possível preparar os perfis de demonstração.");
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
