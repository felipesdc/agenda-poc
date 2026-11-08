import { format } from "date-fns";
import type { Task } from "@prisma/client";
import { frequencyLabels } from "./task-frequency";

export const MAX_CSV_TASKS = 5000;
type CsvTask = Pick<Task, "title" | "description" | "dueDate" | "status" | "frequency"> & { focalPoints: { name: string }[] };

export function csvCell(value: string): string {
  // Quoting prevents delimiter breakout; the leading apostrophe keeps formula-like text as text.
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function tasksToCsv(tasks: CsvTask[]): string {
  const rows: string[][] = [["Título", "Descrição", "Prazo", "Estado", "Periodicidade", "Pontos focais"]];
  for (const task of tasks) rows.push([
    task.title, task.description || "", format(new Date(task.dueDate), "dd/MM/yyyy"),
    { PENDING: "Pendente", COMPLETED: "Concluída", VALIDATED: "Validada" }[task.status],
    frequencyLabels[task.frequency], task.focalPoints.map((employee) => employee.name).join(" | "),
  ]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
