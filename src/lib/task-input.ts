import { z } from "zod";

import { frequencyLabels } from "./task-frequency";

export const taskSchema = z.object({
  title: z.string().trim().min(3, "O título deve ter pelo menos 3 caracteres"),
  description: z.string().optional(),
  dueDate: z.iso.date({ error: "Informe uma data válida" }),
  frequency: z.enum(Object.keys(frequencyLabels) as [keyof typeof frequencyLabels, ...(keyof typeof frequencyLabels)[]]).default("NONE"),
  focalPoints: z.array(
    z.string().regex(/^[1-9]\d*$/, "Matrícula inválida")
      .transform(Number).pipe(z.number().int().positive().max(2147483647, "Matrícula inválida"))
  ).transform((ids) => [...new Set(ids)]),
});

export type TaskFieldErrors = Partial<Record<keyof z.input<typeof taskSchema>, string[]>>;

export function parseTaskFormData(formData: FormData) {
  return taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate"),
    frequency: formData.get("frequency") ?? undefined,
    focalPoints: formData.getAll("focalPoints"),
  });
}
