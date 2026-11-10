"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { useState } from "react";
import { getDayStatusColor, getTaskStatusColor, taskStatusLabels, colorMap, cn } from "@/lib/utils";
import { Employee, User } from "@prisma/client";
import TaskModal, { type TaskWithHistory } from "./TaskModal";

interface CalendarProps {
  tasks: TaskWithHistory[];
  currentDate: Date;
  currentUser: User | null; // <--- Nova prop
  employees: Employee[];
}

export default function DashboardCalendar({
  tasks,
  currentDate,
  currentUser,
  employees,
}: CalendarProps) {
  const [selectedTask, setSelectedTask] = useState<TaskWithHistory | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <>
      {/* Componente Modal renderizado condicionalmente */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUser={currentUser}
          employees={employees}
        />
      )}
      <div className="bg-surface rounded-xl shadow-sm border p-3 sm:p-6 overflow-x-auto" role="region" aria-label="Calendário mensal" tabIndex={0}>
        {/* CORREÇÃO AQUI: 
         Adicionei o wrapper 'grid grid-cols-7' para forçar o layout de 7 colunas.
      */}
        <div className="grid min-w-[350px] grid-cols-7 gap-1 text-center text-sm">
          {/* Cabeçalho dos dias da semana */}
          {weekDays.map((d) => (
            <div key={d} className="font-medium text-gray-400 py-2">
              {d}
            </div>
          ))}

          {/* Loop dos dias do mês */}
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);

            // --- CORREÇÃO DE SEGURANÇA ---
            // O Next.js pode serializar datas como string ao passar do Server Component.
            // Vamos garantir que 't.dueDate' seja um objeto Date real antes de comparar.
            const dayTasks = tasks.filter((t) =>
              isSameDay(new Date(t.dueDate), day)
            );
            // -----------------------------

            const dayColor = getDayStatusColor(dayTasks);
            const colorClass = dayColor ? colorMap[dayColor].calendar : "";

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-24 w-full min-w-0 flex flex-col items-start justify-start p-1 sm:p-2 rounded-md border transition-all relative group",
                  !isCurrentMonth ? "opacity-40 bg-gray-50" : "",
                  colorClass
                    ? colorClass
                    : "border-gray-100 hover:bg-gray-50 text-gray-700",
                  colorClass && "border-transparent"
                )}
              >
                <span aria-current={isSameDay(day, new Date()) ? "date" : undefined} className={cn("mb-1 flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold", isSameDay(day, new Date()) && "bg-blue-600 text-white ring-2 ring-blue-300")}>
                  {format(day, "d")}
                </span>

                {/* LISTA DE TAREFAS CLICÁVEIS */}
                <div className="flex flex-col gap-1 w-full overflow-hidden">
                  {dayTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation(); // Evita cliques indesejados no pai
                        setSelectedTask(t);
                      }}
                      aria-label={t.title}
                      aria-describedby={`calendar-info-${t.id}`}
                      className="min-h-9 w-full min-w-0 rounded px-1 py-1 text-left text-xs hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: colorClass
                          ? "rgba(255,255,255,0.25)"
                          : "var(--muted)",
                      }}
                    >
                      {/* Bolinha de status individual (opcional, ajuda a identificar se tiver mix de cores no dia) */}
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: colorClass ? "white" : "gray",
                        }}
                      />
                      <span className="block truncate font-medium">{t.title}</span><span id={`calendar-info-${t.id}`} className="block truncate text-[10px]">{format(new Date(t.dueDate), "dd/MM")} · {taskStatusLabels[getTaskStatusColor(new Date(t.dueDate), t.status)]}{t.focalPoints.length > 0 && ` · ${t.focalPoints.map((person) => person.name).join(", ")}`}{(t._count?.comments ?? 0) > 0 && ` · ${t._count?.comments} comentário(s)`}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
