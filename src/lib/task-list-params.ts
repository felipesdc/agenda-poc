export type TaskListFilters = {
  q: string;
  status: "ALL" | "PENDING" | "COMPLETED" | "VALIDATED";
  overdue: boolean;
  page: number;
};
type Search = Record<string, string | string[] | undefined>;
export const TASK_LIST_PAGE_SIZE = 25;

export function resolveTaskListParams(params: Search): TaskListFilters {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const overdue = value("overdue") === "true";
  const status = value("status");
  const page = value("page");
  return {
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
  if (page > 1) params.set("page", String(page));
  return `/tarefas${params.size ? `?${params}` : ""}`;
}
