"use client";

import { useActionState, useState } from "react";
import type { Employee } from "@prisma/client";
import { createTask, type FormState } from "@/actions";
import { SubmitButton } from "./SubmitButton";
import TaskFields from "./TaskFields";

const initialState: FormState = { message: "", errors: {}, success: false };

export default function TaskForm({ employees }: { employees: Employee[] }) {
  const [formVersion, setFormVersion] = useState(0);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, data: FormData): Promise<FormState> => {
    try {
      const result = await createTask(previous, data);
      if (result.success) setFormVersion((version) => version + 1);
      return result;
    } catch {
      return { success: false, message: "Não foi possível salvar. Tente novamente." };
    }
  }, initialState);

  return (
    <div className="bg-surface p-6 rounded-xl border shadow-sm h-fit">
      <h3 className="font-semibold text-gray-800 mb-4">Novo compromisso</h3>
      <form action={formAction} aria-label="Cadastrar compromisso" aria-busy={isPending} className="space-y-4">
        <p className="text-xs text-gray-600">Título e prazo final são obrigatórios.</p>
        <TaskFields key={formVersion} employees={employees} errors={state.errors} disabled={isPending} />
        {state.message && <p role={state.success ? "status" : "alert"} className={`p-3 text-xs rounded-md ${state.success ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300"}`}>{state.message}</p>}
        <SubmitButton />
      </form>
    </div>
  );
}
