// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Unidade (Mantém igual)
  const unit = await prisma.unit.upsert({
    where: { code: "U001" },
    update: {},
    create: { name: "Agência Central", code: "U001" },
  });

  // --- NOVOS: CRIANDO FUNCIONÁRIOS (Tabela Employee) ---

  // Funcionário 1: Alice (Que também será usuária Admin)
  const empAlice = await prisma.employee.upsert({
    where: { id: 1001 }, // Matrícula fictícia
    update: {},
    create: {
      id: 1001,
      name: "Alice Gestora",
      email: "admin@banco.com",
    },
  });

  // Funcionário 2: Bob (Que também será usuário Operador)
  const empBob = await prisma.employee.upsert({
    where: { id: 1002 },
    update: {},
    create: {
      id: 1002,
      name: "Bob Operador",
      email: "operador@banco.com",
    },
  });

  // Funcionário 3: Carlos (Apenas Ponto Focal, sem acesso ao sistema)
  const empCarlos = await prisma.employee.upsert({
    where: { id: 1003 },
    update: {},
    create: {
      id: 1003,
      name: "Carlos Especialista",
      email: "carlos@banco.com",
    },
  });

  console.log("Funcionários criados/atualizados!");

  // 2. Usuários do Sistema (Mantém a lógica, mas agora sabemos que eles existem no RH)
  await prisma.user.upsert({
    where: { email: "admin@banco.com" },
    update: { role: "ADMIN" },
    create: {
      name: "Alice Gestora",
      email: "admin@banco.com",
      role: "ADMIN",
      unitId: unit.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "operador@banco.com" },
    update: { role: "OPERATOR" },
    create: {
      name: "Bob Operador",
      email: "operador@banco.com",
      role: "OPERATOR",
      unitId: unit.id,
    },
  });

  console.log("Usuários de sistema sincronizados!");
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
