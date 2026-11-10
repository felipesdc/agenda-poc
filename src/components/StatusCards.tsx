"use client";

import { useId, useState } from "react";
import { format } from "date-fns";
import type { Employee, User } from "@prisma/client";
import { getTaskStatusColor, colorMap, cn } from "@/lib/utils";
import TaskModal, { type TaskWithHistory } from "./TaskModal";

const categories = [
  { color: "red", title: "Vencidas / Críticas" },
  { color: "yellow", title: "Atenção (Próx 15 dias)" },
  { color: "green", title: "No Prazo" },
] as const;
type Category = typeof categories[number]["color"];

export default function StatusCards({ tasks, currentUser, employees }: {
  tasks: TaskWithHistory[];
  currentUser: User | null;
  employees: Employee[];
}) {
  const listId = useId();
  const [expanded, setExpanded] = useState<Category | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTask = tasks.find((task) => task.id === selectedId);
  const grouped: Record<Category, TaskWithHistory[]> = { red: [], yellow: [], green: [] };
  for (const task of tasks) {
    if (task.archivedAt !== null) continue;
    const color = getTaskStatusColor(new Date(task.dueDate), task.status);
    if (color === "red" || color === "yellow" || color === "green") grouped[color].push(task);
  }
  for (const entries of Object.values(grouped)) {
    entries.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }
  const category = categories.find((item) => item.color === expanded);

  return <div className="mb-8">
    {selectedTask && <TaskModal key={selectedTask.id} task={selectedTask} isOpen onClose={() => setSelectedId(null)} currentUser={currentUser} employees={employees} />}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {categories.map(({ color, title }) => <button key={color} type="button" aria-expanded={expanded === color} aria-controls={expanded === color ? listId : undefined} onClick={() => setExpanded(expanded === color ? null : color)} className={cn("rounded-xl border p-6 text-left transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600", colorMap[color].card)}>
        <div className="flex items-center justify-between">
          <div><p className="text-sm font-medium opacity-80">{title}</p><p className="mt-1 text-3xl font-bold">{grouped[color].length}</p></div>
          <span aria-hidden="true" className={cn("h-3 w-3 rounded-full", colorMap[color].dot)} />
        </div>
        <span className="mt-2 block text-xs">{expanded === color ? "Ocultar tarefas" : "Ver tarefas"}</span>
      </button>)}
    </div>
    {category && <section id={listId} aria-label={`Tarefas: ${category.title}`} className="mt-3 rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold text-gray-900">{category.title} · {grouped[category.color].length}</h2><button type="button" onClick={() => setExpanded(null)} className="text-sm text-blue-700 dark:text-blue-300 underline">Fechar lista</button></div>
      <p className="mb-3 text-sm text-gray-600">Tarefas pendentes do período exibido na agenda. Selecione uma tarefa para abrir os detalhes.</p>
      {!grouped[category.color].length && <p className="text-sm text-gray-600">Nenhuma tarefa nesta faixa de prazo.</p>}
      <ul className="max-h-80 space-y-2 overflow-y-auto">{grouped[category.color].map((task) => <li key={task.id}>
        <button type="button" onClick={() => setSelectedId(task.id)} className="w-full rounded-md border border-gray-200 p-3 text-left text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600">
          <span className="block break-words font-medium">{task.title}</span><span className="mt-1 block text-sm text-gray-600">Prazo: {format(new Date(task.dueDate), "dd/MM/yyyy")}</span>{task.focalPoints.length > 0 && <span className="block text-sm text-gray-600">Pontos focais: {task.focalPoints.map((person) => person.name).join(", ")}</span>}{(task._count?.comments ?? 0) > 0 && <span className="block text-sm text-gray-600">Comentários: {task._count?.comments}</span>}
        </button>
      </li>)}</ul>
    </section>}
  </div>;
}
