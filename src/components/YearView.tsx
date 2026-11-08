"use client";

import { useState } from "react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Employee, User } from "@prisma/client";
import { getDayStatusColor, getTaskStatusColor, colorMap, taskStatusLabels, cn } from "@/lib/utils";
import TaskModal, { type TaskWithHistory } from "./TaskModal";

interface YearViewProps {
  tasks: TaskWithHistory[];
  year: number;
  currentUser: User | null;
  employees: Employee[];
}

export default function YearView({ tasks, year, currentUser, employees }: YearViewProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // Derivar a tarefa das props mantém detalhes atualizados após revalidações do servidor.
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const byDay = new Map<string, TaskWithHistory[]>();
  for (const task of tasks) {
    const date = new Date(task.dueDate);
    if (date.getFullYear() !== year) continue;
    const key = format(date, "yyyy-MM-dd");
    const dayTasks = byDay.get(key) || [];
    dayTasks.push(task);
    byDay.set(key, dayTasks);
  }

  return <>
    {selectedTask && <TaskModal key={selectedTask.id} task={selectedTask} isOpen onClose={() => setSelectedTaskId(null)} currentUser={currentUser} employees={employees} />}
    <div className="rounded-xl border bg-surface p-4 shadow-sm sm:p-6">
      <p className="mb-4 text-sm text-gray-600">Selecione um dia com tarefas para ver a lista. Abra uma tarefa para consultar detalhes, histórico e ações disponíveis ao seu perfil.</p>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, monthIndex) => <MiniCalendar key={monthIndex} monthIndex={monthIndex} year={year} byDay={byDay} selectedDay={selectedDay} onSelectDay={setSelectedDay} onSelectTask={setSelectedTaskId} />)}
      </div>
    </div>
  </>;
}

function MiniCalendar({ monthIndex, year, byDay, selectedDay, onSelectDay, onSelectTask }: {
  monthIndex: number;
  year: number;
  byDay: Map<string, TaskWithHistory[]>;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  onSelectTask: (id: string) => void;
}) {
  const date = new Date(year, monthIndex, 1);
  const monthName = format(date, "MMMM", { locale: ptBR });
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(date)), end: endOfWeek(endOfMonth(date)) });
  const monthKey = format(date, "yyyy-MM");
  const selected = selectedDay?.startsWith(`${monthKey}-`) ? selectedDay : null;
  const selectedTasks = selected ? byDay.get(selected) || [] : [];
  const monthCount = [...byDay.entries()].reduce((sum, [key, entries]) => sum + (key.startsWith(`${monthKey}-`) ? entries.length : 0), 0);

  return <section aria-label={`${monthName} ${year}`} className="rounded-lg border p-3">
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-bold capitalize text-gray-700">{monthName}</h3>
      <span className="text-xs text-gray-500">{monthCount} {monthCount === 1 ? "tarefa" : "tarefas"}</span>
    </div>
    <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
      {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={index} aria-hidden="true" className="text-gray-400">{day}</span>)}
      {days.map((day) => {
        const inMonth = isSameMonth(day, date);
        const key = format(day, "yyyy-MM-dd");
        const dayTasks = inMonth ? byDay.get(key) || [] : [];
        const dayColor = getDayStatusColor(dayTasks);
        const label = `${format(day, "dd/MM/yyyy")}: ${dayTasks.length} ${dayTasks.length === 1 ? "tarefa" : "tarefas"}`;
        return <button type="button" key={key} disabled={!inMonth || !dayTasks.length} aria-current={inMonth && isSameDay(day, new Date()) ? "date" : undefined} aria-label={label} aria-pressed={selected === key} onClick={() => onSelectDay(key)} className={cn(
          "relative flex min-h-9 items-center justify-center rounded border border-transparent focus-visible:outline-2 focus-visible:outline-blue-600",
          !inMonth && "invisible", !dayTasks.length && "text-gray-400",
          inMonth && isSameDay(day, new Date()) && "ring-2 ring-inset ring-blue-500",
          dayTasks.length > 0 && "font-semibold text-gray-900 hover:bg-blue-50",
          selected === key && "border-blue-600 bg-blue-50 dark:bg-blue-950/40",
        )}>
          {format(day, "d")}
          {dayColor && <span role="img" aria-label={`${format(day, "dd/MM/yyyy")}: ${taskStatusLabels[dayColor]}`} className={cn("absolute bottom-0.5 h-1.5 w-1.5 rounded-full", colorMap[dayColor].dot)} />}
        </button>;
      })}
    </div>
    {selected && <section aria-label={`Tarefas de ${selected.split("-").reverse().join("/")}`} className="mt-3 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{selected.split("-").reverse().join("/")} · {selectedTasks.length} {selectedTasks.length === 1 ? "tarefa" : "tarefas"}</h4><button type="button" onClick={() => onSelectDay(null)} className="text-xs text-blue-700 dark:text-blue-300 underline">Fechar lista</button></div>
      {!selectedTasks.length && <p className="text-sm text-gray-500">Nenhuma tarefa neste dia.</p>}
      <ul className="max-h-64 space-y-2 overflow-y-auto">{selectedTasks.map((task) => {
        const color = getTaskStatusColor(new Date(task.dueDate), task.status);
        return <li key={task.id}><button type="button" onClick={() => onSelectTask(task.id)} className="w-full rounded border border-gray-200 p-2 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600">
          <span className="block break-words text-sm font-medium text-gray-900">{task.title}</span>
          <span className="mt-1 flex items-center gap-1 text-xs text-gray-600"><span aria-hidden="true" className={cn("h-2 w-2 rounded-full", colorMap[color].dot)} />{taskStatusLabels[color]}</span>
        </button></li>;
      })}</ul>
    </section>}
    <Link href={`/?view=month&month=${monthIndex}&year=${year}`} aria-label={`Abrir ${monthName} na visão mensal`} className="mt-3 inline-block text-xs text-blue-700 dark:text-blue-300 underline">Abrir mês</Link>
  </section>;
}
