import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TaskStatusColor = "red" | "yellow" | "green" | "blue" | "gray";

export function getTaskStatusColor(
  dueDate: Date,
  status: string
): TaskStatusColor {
  if (status === "COMPLETED") return "blue";
  if (status === "VALIDATED") return "gray";

  const now = new Date();

  // CORREÇÃO CRÍTICA:
  // Criamos NOVAS datas para não mutar o objeto original da tarefa
  const checkDate = new Date(dueDate);
  const checkNow = new Date(now);

  // Zeramos as horas apenas nas cópias para comparar dias puros
  checkDate.setHours(0, 0, 0, 0);
  checkNow.setHours(0, 0, 0, 0);

  if (checkDate < checkNow) return "red";

  const daysUntilDue = differenceInDays(checkDate, checkNow);

  if (daysUntilDue <= 15) return "yellow";

  return "green";
}

// Melhoramos o mapa de cores para ter versões separadas para Cards (com hover) e Calendário (estático)
export const colorMap = {
  red: {
    card: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200 hover:bg-red-100",
    calendar: "bg-red-500 text-white dark:bg-red-950/60 dark:text-red-100",
    dot: "bg-red-500",
  },
  yellow: {
    card: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/40 dark:border-yellow-800 dark:text-yellow-200 hover:bg-yellow-100",
    calendar: "bg-yellow-400 text-yellow-950 dark:bg-yellow-950/60 dark:text-yellow-100", // Amarelo mais visível e sem hover
    dot: "bg-yellow-400",
  },
  green: {
    card: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-200 hover:bg-green-100",
    calendar: "bg-green-500 text-white dark:bg-green-950/60 dark:text-green-100",
    dot: "bg-green-500",
  },
  blue: {
    card: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200 hover:bg-blue-100",
    calendar: "bg-blue-500 text-white dark:bg-blue-950/60 dark:text-blue-100",
    dot: "bg-blue-500",
  },
  gray: {
    card: "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
    calendar: "bg-gray-400 text-white dark:bg-gray-200 dark:text-gray-900",
    dot: "bg-gray-400",
  },
};


export const taskStatusLabels: Record<TaskStatusColor, string> = {
  red: "Vencida", yellow: "Vence em até 15 dias", green: "No prazo", blue: "Concluída", gray: "Validada",
};

export function getDayStatusColor(tasks: { dueDate: Date; status: string }[]): TaskStatusColor | null {
  const colors = new Set(tasks.map((task) => getTaskStatusColor(new Date(task.dueDate), task.status)));
  return (["red", "yellow", "green", "blue", "gray"] as const).find((color) => colors.has(color)) ?? null;
}
