import { Task } from "@prisma/client";
import { getTaskStatusColor, colorMap, cn } from "@/lib/utils";

export default function StatusCards({ tasks }: { tasks: Task[] }) {
  // Pré-processamento: Agrupar tarefas por "Cor/Estado"
  // Importante: getTaskStatusColor agora não altera a data original, seguro de usar
  const grouped = {
    red: tasks.filter((t) => getTaskStatusColor(t.dueDate, t.status) === "red"),
    yellow: tasks.filter(
      (t) => getTaskStatusColor(t.dueDate, t.status) === "yellow"
    ),
    green: tasks.filter(
      (t) => getTaskStatusColor(t.dueDate, t.status) === "green"
    ),
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Card Vermelho */}
      <StatusCard
        title="Vencidas / Críticas"
        count={grouped.red.length}
        tasks={grouped.red} // <--- Esta linha é essencial
        colorClass={colorMap.red.card}
        iconColor={colorMap.red.dot}
      />

      {/* Card Amarelo */}
      <StatusCard
        title="Atenção (Próx 15 dias)"
        count={grouped.yellow.length}
        tasks={grouped.yellow} // <--- Esta linha é essencial
        colorClass={colorMap.yellow.card}
        iconColor={colorMap.yellow.dot}
      />

      {/* Card Verde */}
      <StatusCard
        title="No Prazo"
        count={grouped.green.length}
        tasks={grouped.green} // <--- Esta linha é essencial
        colorClass={colorMap.green.card}
        iconColor={colorMap.green.dot}
      />
    </div>
  );
}

// Subcomponente
// Adicionei um valor padrão "tasks = []" para evitar crash caso venha undefined
function StatusCard({ title, count, tasks = [], colorClass, iconColor }: any) {
  return (
    <div
      className={cn(
        "relative group p-6 rounded-xl border transition-all hover:shadow-md",
        colorClass
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-1">{count}</p>
        </div>
        <div className={cn("w-3 h-3 rounded-full", iconColor)} />
      </div>

      {/* Lista que aparece no Hover (Dropdown puro CSS) */}
      {tasks.length > 0 && (
        <div className="absolute left-0 top-full mt-2 w-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
          <div className="bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden max-h-64 overflow-y-auto">
            {tasks.map((task: any) => (
              <div
                key={task.id}
                className="p-3 border-b text-sm hover:bg-gray-50 text-gray-700"
              >
                <p className="font-semibold truncate">{task.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
