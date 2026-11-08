"use client";

import { useId, useState, useRef, useEffect } from "react";
import type { Employee, Task } from "@prisma/client";
import { frequencyLabels } from "@/lib/task-frequency";
import type { TaskFieldErrors } from "@/lib/task-input";

type TaskFieldsProps = {
  employees: Employee[];
  task?: Task & { focalPoints: Employee[] };
  errors?: TaskFieldErrors;
  disabled?: boolean;
};

const inputClass = "w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-surface focus:ring-2 focus:ring-blue-500 outline-none";

export default function TaskFields({ employees, task, errors, disabled }: TaskFieldsProps) {
  const id = useId();
  const fieldsRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (errors && Object.values(errors).some((messages) => messages?.length)) {
      fieldsRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [errors]);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
  const [frequency, setFrequency] = useState<string>(task?.frequency ?? "NONE");
  const [focalPoints, setFocalPoints] = useState<number[]>(task?.focalPoints.map((employee) => employee.id) ?? []);

  const errorProps = (field: keyof TaskFieldErrors) => ({
    "aria-invalid": Boolean(errors?.[field]?.length),
    "aria-describedby": errors?.[field]?.length ? `${id}-${field}-error` : undefined,
  });
  const error = (field: keyof TaskFieldErrors) => errors?.[field]?.length ? (
    <p id={`${id}-${field}-error`} className="text-xs text-red-600 dark:text-red-300 mt-1">{errors[field]?.[0]}</p>
  ) : null;

  return (
    <fieldset ref={fieldsRef} disabled={disabled} className="space-y-4 disabled:opacity-60">
      <div>
        <label htmlFor={`${id}-title`} className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input id={`${id}-title`} name="title" required minLength={3} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Enviar remessa..." className={inputClass} {...errorProps("title")} />
        {error("title")}
      </div>
      <div>
        <label htmlFor={`${id}-dueDate`} className="block text-sm font-medium text-gray-700 mb-1">Prazo final</label>
        <input id={`${id}-dueDate`} name="dueDate" type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={`${inputClass} `} {...errorProps("dueDate")} />
        {error("dueDate")}
      </div>
      <div>
        <label htmlFor={`${id}-frequency`} className="block text-sm font-medium text-gray-700 mb-1">Periodicidade</label>
        <select ref={(select) => {
          // Actions do React também restauram os defaults nativos do select.
          // Mantenha-os alinhados à escolha atual para preservar entradas após falha.
          if (select) for (const option of select.options) option.defaultSelected = option.value === frequency;
        }} id={`${id}-frequency`} name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)} className={inputClass} {...errorProps("frequency")}>
          {Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {error("frequency")}
      </div>
      <fieldset tabIndex={-1} {...errorProps("focalPoints")}>
        <legend className="text-sm font-medium text-gray-700 mb-2">Pontos focais</legend>
        <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto p-2 bg-gray-50">
          {employees.length === 0 ? <p className="text-sm text-gray-500">Nenhum funcionário cadastrado.</p> : employees.map((employee) => (
            <label key={employee.id} className="flex min-h-11 items-center gap-2 p-2 hover:bg-surface rounded cursor-pointer">
              <input ref={(input) => {
                // O reset nativo deve preservar também os pontos focais selecionados.
                if (input) input.defaultChecked = focalPoints.includes(employee.id);
              }} type="checkbox" name="focalPoints" value={employee.id} checked={focalPoints.includes(employee.id)} onChange={(event) => setFocalPoints((ids) => event.target.checked ? [...ids, employee.id] : ids.filter((value) => value !== employee.id))} className="w-5 h-5 rounded border-gray-300" />
              <span className="text-sm text-gray-700">{employee.name}</span>
            </label>
          ))}
        </div>
        {error("focalPoints")}
      </fieldset>
      <div>
        <label htmlFor={`${id}-description`} className="block text-sm font-medium text-gray-700 mb-1">Detalhes</label>
        <textarea id={`${id}-description`} name="description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-none`} {...errorProps("description")} />
        {error("description")}
      </div>
    </fieldset>
  );
}
