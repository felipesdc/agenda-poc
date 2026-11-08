import { z } from "zod";

export const userProfileSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres.").max(120),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
});

export const createUserSchema = userProfileSchema.extend({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  hasPassword: boolean;
  isActive: boolean;
};
export type UserActionState = { success: boolean; message: string };
