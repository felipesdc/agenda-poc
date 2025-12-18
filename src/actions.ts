// app/actions.ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma"; // <--- USE O SINGLETON AQUI
import { revalidatePath } from "next/cache";
import { logTaskHistory } from "@/lib/audit";
import { Frequency } from "@prisma/client";
import { calculateNextDueDate } from "@/lib/frequency"; // <--- Importe a função que criamos
import { format } from "date-fns"; // Importante para formatar as datas no log
import { cookies } from "next/headers"; // <--- Importe
import { getCurrentUser } from "@/lib/auth"; // Use nossa nova função

// O FormState permanece igual...
export type FormState = {
  errors?: {
    title?: string[];
    dueDate?: string[];
    description?: string[];
  };
  message: string;
  success?: boolean;
};

// Schema permanece igual...
const taskSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres"),
  description: z.string().optional(),
  dueDate: z
    .string()
    .refine((date) => new Date(date).toString() !== "Invalid Date", {
      message: "Data inválida",
    }),
  frequency: z.nativeEnum(Frequency).optional(),
});

// --- CREATE ---
export async function createTask(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // Delay mantido para UX
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const validatedFields = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    frequency: formData.get("frequency"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Erro na validação dos campos.",
      success: false,
    };
  }

  const user = await getCurrentUser();
  if (!user) return { message: "Você precisa estar logado.", success: false };

  const focalPointIds = formData.getAll("focalPoints").map((id) => Number(id));

  try {
    const newTask = await prisma.task.create({
      data: {
        title: validatedFields.data.title,
        description: validatedFields.data.description || "",
        dueDate: new Date(`${validatedFields.data.dueDate}T12:00:00Z`),
        status: "PENDING",
        frequency: (validatedFields.data.frequency as Frequency) || "NONE",
        createdById: user.id,
        unitId: user.unitId,

        // --- CONECTANDO PONTOS FOCAIS ---
        focalPoints: {
          connect: focalPointIds.map((id) => ({ id })),
        },
        // --------------------------------
      },
    });

    await logTaskHistory(newTask.id, user.id, "CREATE", "Tarefa criada");

    revalidatePath("/");
    return { success: true, message: "Tarefa criada com sucesso!", errors: {} };
  } catch (e) {
    return { message: "Erro de banco de dados.", success: false };
  }
}

// app/actions.ts

// ... imports

export async function updateTask(
  taskId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // Delay simulado (pode remover se quiser agilizar)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 1. Captura e Validação
  const validatedFields = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    frequency: formData.get("frequency"),
  });

  // CAPTURA OS IDS DOS FUNCIONÁRIOS
  const newFocalPointIds = formData
    .getAll("focalPoints")
    .map((id) => Number(id));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Erro na validação dos campos.",
      success: false,
    };
  }

  const user = await getCurrentUser(); // Usando nossa função de Auth
  if (!user) return { message: "Você precisa estar logado.", success: false };

  try {
    // 2. BUSCAR DADOS ORIGINAIS (COM PONTOS FOCAIS)
    // Precisamos do include aqui para comparar o "Antes"
    const oldTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { focalPoints: true },
    });

    if (!oldTask) return { message: "Tarefa não encontrada", success: false };

    // Preparar dados
    const newDate = new Date(`${validatedFields.data.dueDate}T12:00:00Z`);
    const newFrequency =
      (validatedFields.data.frequency as Frequency) || "NONE";
    const newTitle = validatedFields.data.title;
    const newDesc = validatedFields.data.description || "";

    // 3. ATUALIZAR NO BANCO
    await prisma.task.update({
      where: { id: taskId },
      data: {
        title: newTitle,
        description: newDesc,
        dueDate: newDate,
        frequency: newFrequency,

        // Atualiza relacionamento N:N
        focalPoints: {
          set: newFocalPointIds.map((id) => ({ id })),
        },
      },
    });

    // 4. AUDITORIA INTELIGENTE

    // ... (Logs de Título, Data, Frequência e Descrição anteriores mantidos aqui) ...
    if (oldTask.title !== newTitle)
      await logTaskHistory(taskId, user.id, "UPDATE", `Título alterado.`);
    if (oldTask.dueDate.getTime() !== newDate.getTime()) {
      await logTaskHistory(taskId, user.id, "UPDATE", `Prazo alterado.`);
    }
    if (oldTask.frequency !== newFrequency)
      await logTaskHistory(
        taskId,
        user.id,
        "UPDATE",
        `Periodicidade alterada.`
      );

    // --- NOVO: LOG DE PONTOS FOCAIS ---
    // Lógica: Criamos arrays de IDs ordenados e comparamos como strings
    const oldIds = oldTask.focalPoints
      .map((emp) => emp.id)
      .sort((a, b) => a - b)
      .join(",");
    const newIdsSorted = newFocalPointIds.sort((a, b) => a - b).join(",");

    if (oldIds !== newIdsSorted) {
      await logTaskHistory(
        taskId,
        user.id,
        "UPDATE",
        "Lista de Pontos Focais alterada."
      );
    }
    // ----------------------------------

    revalidatePath("/");
    return {
      success: true,
      message: "Tarefa atualizada com sucesso!",
      errors: {},
    };
  } catch (e) {
    console.error(e);
    return { message: "Erro ao atualizar tarefa.", success: false };
  }
}

// --- DELETE ---
export async function deleteTask(taskId: string) {
  // Buscamos o usuário para tentar logar a ação (mesmo que o log suma com o cascade, é boa prática)
  const user = await getCurrentUser();
  if (!user) return { message: "Você precisa estar logado.", success: false };

  try {
    // Opcional: Logar antes de deletar (se usássemos Soft Delete, seria essencial)
    /* if (user) {
       await logTaskHistory(taskId, user.id, "DELETE", "Tarefa excluída");
    }
    */

    await prisma.task.delete({
      where: { id: taskId },
    });

    revalidatePath("/");
    return { success: true, message: "Tarefa excluída." };
  } catch (e) {
    return { success: false, message: "Erro ao excluir." };
  }
}

// 5. Action de CONCLUSÃO (Operador)
export async function completeTask(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return { message: "Você precisa estar logado.", success: false };

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(), // Data/Hora atual
      },
    });

    await logTaskHistory(
      taskId,
      user.id,
      "COMPLETE",
      "Tarefa marcada como concluída"
    );
    revalidatePath("/");
    return { success: true, message: "Tarefa concluída!" };
  } catch (e) {
    return { success: false, message: "Erro ao concluir." };
  }
}

// 6. Action de VALIDAÇÃO (Gestor) + GERAÇÃO DA PRÓXIMA
export async function validateTask(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return { message: "Você precisa estar logado.", success: false };

  // VERIFICAÇÃO DE PERFIL
  if (user.role !== "ADMIN") {
    return {
      success: false,
      message: "Acesso Negado: Apenas gestores podem validar tarefas.",
    };
  }
  try {
    // 1. Buscamos a tarefa atual para saber a periodicidade e data base
    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!currentTask)
      return { success: false, message: "Tarefa não encontrada." };

    // 2. Atualizamos a atual para VALIDATED
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "VALIDATED",
        validatedAt: new Date(),
      },
    });

    await logTaskHistory(
      taskId,
      user.id,
      "VALIDATE",
      "Conclusão validada pelo gestor"
    );

    // 3. Lógica de Recorrência (A Mágica)
    const nextDate = calculateNextDueDate(
      currentTask.dueDate,
      currentTask.frequency
    );

    if (nextDate) {
      const nextTask = await prisma.task.create({
        data: {
          title: currentTask.title,
          description: currentTask.description,
          dueDate: nextDate, // Nova data calculada
          status: "PENDING",
          frequency: currentTask.frequency, // Mantém a periodicidade
          createdById: user.id, // O sistema ou o gestor criou
          unitId: currentTask.unitId,
        },
      });

      // Logamos na NOVA tarefa que ela nasceu de uma recorrência
      await logTaskHistory(
        nextTask.id,
        user.id,
        "CREATE",
        `Gerada automaticamente (Recorrência de ${currentTask.title})`
      );

      revalidatePath("/");
      return { success: true, message: "Validado! Próxima tarefa gerada." };
    }

    revalidatePath("/");
    return { success: true, message: "Tarefa validada e finalizada." };
  } catch (e) {
    console.error(e);
    return { success: false, message: "Erro ao validar." };
  }
}

// ACTION DE LOGIN (Simulado)
export async function switchUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    const cookieStore = await cookies();
    // Define um cookie que expira em 1 dia
    cookieStore.set("userId", user.id, {
      secure: true,
      httpOnly: true,
      maxAge: 86400,
    });
    revalidatePath("/");
  }
}
