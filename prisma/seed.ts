// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Unidade
  const unit = await prisma.unit.upsert({
    where: { code: "U001" },
    update: {},
    create: { name: "Agência Central", code: "U001" },
  });

  // 2. Usuário ADMIN (Gestor)
  await prisma.user.upsert({
    where: { email: "admin@banco.com" },
    update: { role: "ADMIN" }, // Garante que seja Admin
    create: {
      name: "Alice Gestora",
      email: "admin@banco.com",
      role: "ADMIN",
      unitId: unit.id,
    },
  });

  // 3. Usuário OPERATOR (Funcionário)
  await prisma.user.upsert({
    where: { email: "operador@banco.com" },
    update: { role: "OPERATOR" }, // Garante que seja Operador
    create: {
      name: "Bob Operador",
      email: "operador@banco.com",
      role: "OPERATOR",
      unitId: unit.id,
    },
  });

  console.log("Banco de dados populado com sucesso!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
