import { z } from "zod";

export type TaskListFilters = {
  q: string;
  status: "ALL" | "PENDING" | "COMPLETED" | "VALIDATED";
  overdue: boolean;
  page: number;
  focalPoint: number | null;
  from: string;
  to: string;
  errors: string[];
};
type Search = Record<string, string | string[] | undefined>;
export const TASK_LIST_PAGE_SIZE = 25;

export function resolveTaskListParams(params: Search): TaskListFilters {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const overdue = value("overdue") === "true";
  const status = value("status");
  const page = value("page");
  const errors: string[] = [];
  const from = value("from");
  const to = value("to");
  for (const [key, label] of [["from", "inicial"], ["to", "final"]]) {
    if (Array.isArray(params[key]) || (value(key) && !z.iso.date().safeParse(value(key)).success)) errors.push(`Informe uma data ${label} válida.`);
  }
  if (!errors.length && from && to && from > to) errors.push("O prazo inicial deve ser anterior ou igual ao prazo final.");
  const focal = value("focalPoint");
  const focalValid = /^[1-9]\d*$/.test(focal) && Number(focal) <= 2147483647;
  if (Array.isArray(params.focalPoint) || (focal && !focalValid)) errors.push("Selecione um ponto focal válido.");
  return {
    from, to, focalPoint: focalValid ? Number(focal) : null, errors,
    q: value("q").trim().slice(0, 120),
    status: overdue ? "PENDING" : status === "PENDING" || status === "COMPLETED" || status === "VALIDATED" ? status : "ALL",
    overdue,
    page: /^\d+$/.test(page) && Number.isSafeInteger(Number(page)) && Number(page) > 0 ? Math.min(Number(page), 100000) : 1,
  };
}

export function taskListUrl(filters: TaskListFilters, page = filters.page) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.overdue) params.set("overdue", "true");
  if (filters.focalPoint !== null) params.set("focalPoint", String(filters.focalPoint));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  return `/tarefas${params.size ? `?${params}` : ""}`;
}

export function taskExportUrl(filters: TaskListFilters) {
  return taskListUrl(filters, 1).replace("/tarefas", "/api/tarefas/exportar");
}
