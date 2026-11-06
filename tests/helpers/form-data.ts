export function taskForm(overrides: Record<string, string | string[]> = {}) {
  const data = new FormData();
  const values = { title: "Enviar remessa", dueDate: "2026-11-05", ...overrides };
  for (const [name, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(name, entry);
  }
  return data;
}
