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
import { getTaskStatusColor, colorMap, cn } from "@/lib/utils";
import { Employee, Task, User } from "@prisma/client";
import TaskModal from "./TaskModal";

interface CalendarProps {
  tasks: any[];
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
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getDayColor = (date: Date) => {
    const tasksForDay = tasks.filter((t) => isSameDay(t.dueDate, date));
    if (tasksForDay.length === 0) return "";

    const statuses = tasksForDay.map((t) =>
      getTaskStatusColor(t.dueDate, t.status)
    );

    if (statuses.includes("red")) return colorMap.red.calendar;
    if (statuses.includes("yellow")) return colorMap.yellow.calendar;
    if (statuses.includes("green")) return colorMap.green.calendar;
    if (statuses.includes("blue")) return colorMap.blue.calendar;

    return colorMap.gray.calendar;
  };

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
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {/* CORREÇÃO AQUI: 
         Adicionei o wrapper 'grid grid-cols-7' para forçar o layout de 7 colunas.
      */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
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

            // Recalcula a cor baseado nessas tarefas filtradas
            let colorClass = "";
            if (dayTasks.length > 0) {
              // Replicamos a lógica do getDayColor aqui para usar o dayTasks já filtrado
              const statuses = dayTasks.map((t) =>
                getTaskStatusColor(new Date(t.dueDate), t.status)
              );
              if (statuses.includes("red")) colorClass = colorMap.red.calendar;
              else if (statuses.includes("yellow"))
                colorClass = colorMap.yellow.calendar;
              else if (statuses.includes("green"))
                colorClass = colorMap.green.calendar;
              else if (statuses.includes("blue"))
                colorClass = colorMap.blue.calendar;
              else colorClass = colorMap.gray.calendar;
            }

            return (
              <div
                key={idx}
                className={cn(
                  "h-24 w-full flex flex-col items-start justify-start p-2 rounded-md border transition-all relative group",
                  !isCurrentMonth ? "opacity-40 bg-gray-50" : "",
                  colorClass
                    ? colorClass
                    : "border-gray-100 hover:bg-gray-50 text-gray-700",
                  colorClass && "border-transparent"
                )}
              >
                <span className="font-semibold text-xs mb-1">
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
                      className="text-[10px] truncate w-full text-left px-1 rounded hover:opacity-80 transition-opacity flex items-center gap-1"
                      style={{
                        backgroundColor: colorClass
                          ? "rgba(255,255,255,0.25)"
                          : "#f3f4f6",
                      }}
                    >
                      {/* Bolinha de status individual (opcional, ajuda a identificar se tiver mix de cores no dia) */}
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: colorClass ? "white" : "gray",
                        }}
                      />
                      {t.title}
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
