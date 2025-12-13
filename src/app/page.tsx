import { PrismaClient } from "@prisma/client";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import DashboardCalendar from "@/components/DashboardCalendar";
import StatusCards from "@/components/StatusCards";
import TaskForm from "@/components/TaskForm";
import DateFilter from "@/components/DateFilter";
import YearView from "@/components/YearView"; // Vamos criar jajá
import UserSwitcher from "@/components/UserSwitcher";
import { getCurrentUser } from "@/lib/auth"; // <--- Importe nossa nova função

const prisma = new PrismaClient();

// No Next.js App Router, searchParams é injetado como prop na página
export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const resolvedParams = await searchParams; // Next 15 exige await nos params

  // --- CORREÇÃO ---
  const now = new Date();
  const view = resolvedParams.view === "year" ? "year" : "month";

  // Verificação explícita de undefined/null
  const month =
    resolvedParams.month !== undefined
      ? Number(resolvedParams.month)
      : now.getMonth();

  const year =
    resolvedParams.year !== undefined
      ? Number(resolvedParams.year)
      : now.getFullYear();
  // ----------------

  // 1. Busque o usuário real
  const currentUser = await getCurrentUser();

  const referenceDate = new Date(year, month, 1);

  // 2. Definir o range de busca (Otimização do Banco)
  const rangeStart =
    view === "month" ? startOfMonth(referenceDate) : startOfYear(referenceDate);
  const rangeEnd =
    view === "month" ? endOfMonth(referenceDate) : endOfYear(referenceDate);

  // 3. Buscar APENAS tarefas desse período
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    include: {
      history: {
        include: { user: true }, // Traz o nome do usuário do histórico
        orderBy: { timestamp: "desc" }, // O mais recente primeiro
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Para os cards de estatística, talvez você queira ver o total geral ou apenas do mês?
  // Por enquanto, vamos manter os cards reagindo ao filtro atual.

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {" "}
        {/* Aumentei um pouco a largura */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Agenda da Unidade
          </h1>
        </header>
        {/* Componente de Filtro Controla a URL */}
        <DateFilter />
        <StatusCards tasks={tasks} />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            {/* Renderização Condicional da View */}
            {view === "month" ? (
              <DashboardCalendar
                tasks={tasks}
                currentDate={referenceDate} // Passamos a data selecionada
                currentUser={currentUser}
              />
            ) : (
              <YearView tasks={tasks} year={year} />
            )}
          </div>

          <div>
            <TaskForm />
          </div>
        </div>
      </div>
      <UserSwitcher currentUser={currentUser} />
    </main>
  );
}
