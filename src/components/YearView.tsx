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
  setMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { getTaskStatusColor, cn } from "@/lib/utils";
import { Task } from "@prisma/client";

interface YearViewProps {
  tasks: Task[];
  year: number;
}

export default function YearView({ tasks, year }: YearViewProps) {
  const months = Array.from({ length: 12 }, (_, i) => i); // 0 a 11

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {months.map((monthIndex) => (
          <MiniCalendar
            key={monthIndex}
            monthIndex={monthIndex}
            year={year}
            tasks={tasks}
          />
        ))}
      </div>
    </div>
  );
}

// Subcomponente apenas visual para não poluir

function MiniCalendar({
  monthIndex,
  year,
  tasks,
}: {
  monthIndex: number;
  year: number;
  tasks: Task[];
}) {
  const date = new Date(year, monthIndex, 1);
  const start = startOfWeek(startOfMonth(date));
  const end = endOfWeek(endOfMonth(date));
  const days = eachDayOfInterval({ start, end });

  const monthTasks = tasks.filter((t) => t.dueDate.getMonth() === monthIndex);

  return (
    <div className="border rounded-lg p-3">
      <h3 className="text-sm font-bold text-gray-700 mb-2 capitalize">
        {format(date, "MMMM", { locale: ptBR })}
      </h3>

      {/* CORREÇÃO APLICADA AQUI: */}
      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          // Usamos 'i' (índice) como key, pois a ordem dos dias nunca muda
          <span key={i} className="text-gray-400">
            {d}
          </span>
        ))}

        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, date);
          const dayTasks = monthTasks.filter((t) => isSameDay(t.dueDate, day));

          let dotColor = "";
          if (dayTasks.length > 0) {
            const statuses = dayTasks.map((t) =>
              getTaskStatusColor(t.dueDate, t.status)
            );
            if (statuses.includes("red")) dotColor = "bg-red-500";
            else if (statuses.includes("yellow")) dotColor = "bg-yellow-400";
            else dotColor = "bg-green-500";
          }

          return (
            <div
              key={idx}
              className={cn(
                "aspect-square flex items-center justify-center rounded-sm relative",
                !isCurrentMonth && "opacity-20"
              )}
            >
              <span
                className={cn(
                  dotColor ? "font-bold text-gray-900" : "text-gray-500"
                )}
              >
                {format(day, "d")}
              </span>
              {dotColor && (
                <div
                  className={cn(
                    "absolute bottom-0.5 w-1 h-1 rounded-full",
                    dotColor
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
