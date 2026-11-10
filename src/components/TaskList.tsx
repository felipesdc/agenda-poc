"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Employee, User } from "@prisma/client";
import TaskModal, { type TaskWithHistory } from "./TaskModal";
import { getTaskStatusColor, taskStatusLabels, colorMap, cn } from "@/lib/utils";

export default function TaskList({ tasks, currentUser, employees, validationQueue = false, label }: { tasks: TaskWithHistory[]; currentUser: User; employees: Employee[]; validationQueue?: boolean; label?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTask = tasks.find((task) => task.id === selectedId);
  return <>
    {selectedTask && <TaskModal key={selectedTask.id} task={selectedTask} isOpen onClose={() => setSelectedId(null)} currentUser={currentUser} employees={employees} />}
    {!tasks.length && <p className="rounded border bg-surface p-4">{validationQueue ? "Nenhuma tarefa aguardando validação nesta consulta." : "Nenhuma tarefa corresponde aos filtros. Revise a busca ou limpe os filtros."}</p>}
    <ul aria-label={label ?? (validationQueue ? "Tarefas aguardando validação" : "Resultados da busca")} className="space-y-3">{tasks.map((task) => {
      const color = getTaskStatusColor(new Date(task.dueDate), task.status);
      return <li key={task.id}><button type="button" onClick={() => setSelectedId(task.id)} className="w-full space-y-2 rounded-lg border bg-surface p-4 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600">
        <span className="block break-words font-semibold">{task.title}</span>
        <span className="block text-sm">Prazo: {format(new Date(task.dueDate), "dd/MM/yyyy")}</span>
        <span className="flex items-center gap-2 text-sm"><span aria-hidden="true" className={cn("h-2 w-2 rounded-full", colorMap[color].dot)} />{taskStatusLabels[color]}</span>
        {validationQueue && <span className="block text-sm text-gray-600">{task.completedAt ? `Concluída em: ${format(new Date(task.completedAt), "dd/MM/yyyy 'às' HH:mm")}` : "Data de conclusão não registrada"}</span>}
        {(task._count?.comments ?? 0) > 0 && <span className="block text-sm text-gray-600">Comentários: {task._count?.comments}</span>}
        {task.focalPoints.length > 0 && <span className="block text-sm text-gray-600">Pontos focais: {task.focalPoints.map((employee) => employee.name).join(", ")}</span>}
      </button></li>;
    })}</ul>
  </>;
}
