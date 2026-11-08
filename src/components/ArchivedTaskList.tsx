"use client";

import { useState } from "react";
import type { User } from "@prisma/client";
import { format } from "date-fns";
import TaskModal, { type TaskWithHistory } from "./TaskModal";

export default function ArchivedTaskList({ tasks, currentUser }: { tasks: TaskWithHistory[]; currentUser: User }) {
  const [selectedTask, setSelectedTask] = useState<TaskWithHistory | null>(null);
  return (
    <section aria-labelledby="archived-heading" className="bg-surface border rounded-xl p-6">
      <h2 id="archived-heading" className="text-xl font-semibold text-gray-900">Tarefas arquivadas</h2>
      <p className="mt-1 mb-4 text-sm text-gray-600">Todos os períodos da sua unidade. Abra uma tarefa para consultar os detalhes e o histórico.</p>
      {tasks.length === 0 ? <p className="text-gray-500">Nenhuma tarefa arquivada nesta unidade.</p> : (
        <ul className="divide-y">
          {tasks.map((task) => <li key={task.id} className="py-4">
            <button type="button" onClick={() => setSelectedTask(task)} className="font-medium text-blue-700 dark:text-blue-300 hover:underline" aria-label={`Ver detalhes de ${task.title}`}>{task.title}</button>
            <p className="text-sm text-gray-500">Prazo: {format(new Date(task.dueDate), "dd/MM/yyyy")} · Arquivada em {task.archivedAt ? format(new Date(task.archivedAt), "dd/MM/yyyy") : "-"}</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{task.archiveReason}</p>
          </li>)}
        </ul>
      )}
      {selectedTask && <TaskModal task={selectedTask} isOpen onClose={() => setSelectedTask(null)} currentUser={currentUser} employees={[]} />}
    </section>
  );
}
