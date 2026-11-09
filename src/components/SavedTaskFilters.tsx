"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { addSavedFilter, readSavedFilters, savedFiltersKey } from "@/lib/saved-task-filters";
import { taskListUrl, type TaskListFilters } from "@/lib/task-list-params";

const EVENT = "agenda:saved-task-filters";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}

export default function SavedTaskFilters({ userId, unitId, filters }: { userId: string; unitId: string; filters: TaskListFilters }) {
  const key = savedFiltersKey(userId, unitId);
  const id = useId();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key); } catch { return null; } }, () => null);
  const saved = readSavedFilters(raw);
  const current = taskListUrl(filters, 1);
  function change(operation: (items: ReturnType<typeof readSavedFilters>) => ReturnType<typeof readSavedFilters>, success: string) {
    try {
      // Leia novamente ao gravar para respeitar alterações recentes em outra aba.
      const next = operation(readSavedFilters(localStorage.getItem(key)));
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
      setMessage({ text: success, error: false });
      return true;
    } catch (error) {
      setMessage({ text: error instanceof Error && error.name === "Error" ? error.message : "Não foi possível salvar neste navegador. Verifique as permissões de armazenamento e tente novamente.", error: true });
      return false;
    }
  }
  return <section aria-labelledby={`${id}-heading`} className="space-y-3 rounded-xl border bg-surface p-4 sm:p-6">
    <h2 id={`${id}-heading`} className="font-semibold">Filtros favoritos</h2>
    <p id={`${id}-help`} className="text-sm text-gray-600">Salve os filtros já aplicados para reutilizar neste navegador, com seu usuário e unidade. Datas são fixas; a opção de vencidas acompanha o dia atual. Até 10 favoritos.</p>
    <form aria-label="Salvar filtros favoritos" onSubmit={(event) => { event.preventDefault(); if (change((items) => addSavedFilter(items, name, filters), "Favorito salvo.")) setName(""); }} className="flex flex-wrap items-end gap-3">
      <div className="grow"><label htmlFor={`${id}-name`} className="block text-sm font-medium">Nome do favorito</label><input id={`${id}-name`} required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} aria-describedby={`${id}-help`} className="mt-1 w-full rounded border p-2" placeholder="Ex.: Pendências da equipe" /></div>
      <button type="submit" disabled={filters.errors.length > 0} className="rounded border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Salvar consulta atual</button>
    </form>
    {filters.errors.length > 0 && <p className="text-sm text-gray-600">Corrija e aplique os filtros antes de salvar.</p>}
    {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-red-700 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>{message.text}</p>}
    {saved.length === 0 ? <p className="text-sm text-gray-600">Nenhum filtro favorito salvo neste navegador.</p> : <ul aria-label="Consultas favoritas" className="flex flex-wrap gap-3">{saved.map((item) => <li key={item.name} className="flex max-w-full items-center gap-1 rounded-lg border p-1">
      <Link href={item.href} aria-current={!filters.errors.length && item.href === current ? "page" : undefined} className="break-words rounded px-3 py-2 text-sm text-blue-700 hover:bg-muted dark:text-blue-300">{item.name}{!filters.errors.length && item.href === current && <span className="ml-2 text-xs text-gray-600">(atual)</span>}</Link>
      <button type="button" aria-label={`Remover favorito ${item.name}`} onClick={() => change((items) => items.filter((saved) => saved.name !== item.name), `Favorito ${item.name} removido.`)} className="min-h-11 shrink-0 rounded px-3 text-sm text-gray-600 hover:bg-muted">Remover</button>
    </li>)}</ul>}
  </section>;
}
