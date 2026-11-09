import { resolveTaskListParams, taskListUrl, type TaskListFilters } from "./task-list-params";

export const MAX_SAVED_FILTERS = 10;
export type SavedTaskFilter = { name: string; href: string };
export function savedFiltersKey(userId: string, unitId: string) {
  return `agenda:task-filters:v1:${encodeURIComponent(unitId)}:${encodeURIComponent(userId)}`;
}

// Persistimos somente URLs locais reconstruídas pelo parser da lista.
export function canonicalFilterUrl(href: string): string | null {
  try {
    const url = new URL(href, "https://agenda.invalid");
    if (url.origin !== "https://agenda.invalid" || url.pathname !== "/tarefas" || url.hash) return null;
    const params: Record<string, string | string[]> = {};
    for (const key of url.searchParams.keys()) params[key] = url.searchParams.getAll(key).length > 1 ? url.searchParams.getAll(key) : url.searchParams.get(key)!;
    const filters = resolveTaskListParams(params);
    return filters.errors.length ? null : taskListUrl(filters, 1);
  } catch { return null; }
}

export function readSavedFilters(raw: string | null): SavedTaskFilter[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const result: SavedTaskFilter[] = [];
    for (const item of value) {
      if (!item || typeof item.name !== "string" || typeof item.href !== "string") continue;
      const name = item.name.trim();
      const href = canonicalFilterUrl(item.href);
      if (!name || name.length > 50 || href === null || result.some((saved) => saved.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) continue;
      result.push({ name, href });
      if (result.length === MAX_SAVED_FILTERS) break;
    }
    return result;
  } catch { return []; }
}

export function addSavedFilter(saved: SavedTaskFilter[], name: string, filters: TaskListFilters): SavedTaskFilter[] {
  name = name.trim();
  if (!name || name.length > 50) throw new Error("Informe um nome de 1 a 50 caracteres.");
  if (filters.errors.length) throw new Error("Corrija e aplique os filtros antes de salvar.");
  if (saved.some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) throw new Error("Já existe um favorito com esse nome. Escolha outro nome.");
  if (saved.length >= MAX_SAVED_FILTERS) throw new Error("Você já tem 10 favoritos. Remova um para salvar outro.");
  return [...saved, { name, href: taskListUrl(filters, 1) }];
}
