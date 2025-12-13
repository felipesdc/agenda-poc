"use client";

import { useActionState } from "react";
import { createTask, type FormState } from "@/actions"; // <--- Importe o tipo aqui
import { SubmitButton } from "./SubmitButton";
import { useEffect, useRef } from "react";

// O estado inicial tipado corretamente
const initialState: FormState = {
  message: "",
  errors: {},
  success: false,
};

export default function TaskForm() {
  const [state, formAction] = useActionState(createTask, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state.success]);

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        Novo Compromisso
      </h3>

      <form ref={formRef} action={formAction} className="space-y-4">
        {/* Título */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Título
          </label>
          <input
            type="text"
            id="title"
            name="title"
            placeholder="Ex: Enviar remessa..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {/* Zod retorna array de strings, pegamos o primeiro erro */}
          {state?.errors?.title && (
            <p className="text-xs text-red-500 mt-1">{state.errors.title[0]}</p>
          )}
        </div>

        {/* Data */}
        <div>
          <label
            htmlFor="dueDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Prazo Final
          </label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 [color-scheme:light] focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {state?.errors?.dueDate && (
            <p className="text-xs text-red-500 mt-1">
              {state.errors.dueDate[0]}
            </p>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Detalhes
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          ></textarea>
        </div>

        {/* Mensagens Gerais */}
        {!state.success && state.message && (
          <div className="p-3 bg-red-50 text-red-600 text-xs rounded-md">
            {state.message}
          </div>
        )}

        {state.success && (
          <div className="p-3 bg-green-50 text-green-600 text-xs rounded-md">
            Tarefa adicionada à agenda!
          </div>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
