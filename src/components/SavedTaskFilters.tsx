"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { addAccountFilter, getSavedTaskFilters, removeAccountFilter, type AccountFilter } from "@/actions/saved-filters";
import { readSavedFilters, savedFiltersKey, type SavedTaskFilter } from "@/lib/saved-task-filters";
import { taskListUrl, type TaskListFilters } from "@/lib/task-list-params";

export default function SavedTaskFilters({ userId, unitId, filters }: { userId: string; unitId: string; filters: TaskListFilters }) {
  const id = useId(); const [name, setName] = useState(""); const [saved, setSaved] = useState<AccountFilter[]>([]); const [legacy, setLegacy] = useState<SavedTaskFilter[]>([]);
  const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false); const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const current = taskListUrl(filters, 1); const key = savedFiltersKey(userId, unitId);
  async function refresh() { const result = await getSavedTaskFilters(); if (!result.success) throw new Error("Não foi possível carregar os favoritos."); setSaved(result.items); setLoaded(true); }
  useEffect(() => { let live = true; void getSavedTaskFilters().then((result) => { if (live) { if (result.success) { setSaved(result.items); setLoaded(true); } else setMessage({ text: "Não foi possível carregar os favoritos.", error: true }); } }).catch(() => { if (live) setMessage({ text: "Não foi possível carregar os favoritos.", error: true }); }); try { setLegacy(readSavedFilters(localStorage.getItem(key))); } catch { /* Conta continua disponível sem armazenamento local. */ } return () => { live = false; }; }, [key]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || filters.errors.length) return; setBusy(true); setMessage(null);
    try { const result = await addAccountFilter(name, current); setMessage({ text: result.message, error: !result.success }); if (result.success) { setName(""); await refresh(); } }
    catch { setMessage({ text: "Não foi possível salvar o favorito.", error: true }); } finally { setBusy(false); }
  }
  async function remove(item: AccountFilter) { if (busy) return; setBusy(true); setMessage(null); try { const result = await removeAccountFilter(item.id); setMessage({ text: result.message, error: !result.success }); if (result.success) await refresh(); } catch { setMessage({ text: "Não foi possível remover o favorito.", error: true }); } finally { setBusy(false); } }
  async function importLegacy() {
    if (busy) return; setBusy(true); setMessage(null); let imported = 0; const remaining: SavedTaskFilter[] = [];
    try {
      for (const item of legacy) { const result = await addAccountFilter(item.name, item.href); if (result.success) imported++; else remaining.push(item); }
      try { localStorage.setItem(key, JSON.stringify(remaining)); setLegacy(remaining); } catch { /* Não apague os dados que não puderam ser preservados. */ }
      await refresh(); setMessage({ text: `${imported} favorito(s) importado(s).${remaining.length ? " Os demais permanecem neste navegador; confira nomes duplicados e limite." : ""}`, error: false });
    } catch { setMessage({ text: "Importação interrompida. Seus favoritos locais foram preservados.", error: true }); } finally { setBusy(false); }
  }
  return <section aria-labelledby={`${id}-heading`} className="space-y-3 rounded-xl border bg-surface p-4 sm:p-6"><h2 id={`${id}-heading`} className="font-semibold">Filtros favoritos</h2>
    <p id={`${id}-help`} className="text-sm text-gray-600">Salve os filtros aplicados na sua conta para usá-los em outros dispositivos. Datas são fixas; vencidas acompanham o dia atual. Até 10 favoritos.</p>
    <form aria-label="Salvar filtros favoritos" onSubmit={save} className="flex flex-wrap items-end gap-3"><div className="grow"><label htmlFor={`${id}-name`} className="block text-sm font-medium">Nome do favorito</label><input id={`${id}-name`} required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} aria-describedby={`${id}-help`} className="mt-1 w-full rounded border p-2" placeholder="Ex.: Pendências da equipe" /></div><button type="submit" disabled={!loaded || busy || filters.errors.length > 0} className="min-h-11 rounded border px-4 py-2 font-medium hover:bg-muted disabled:opacity-50">Salvar consulta atual</button></form>
    {filters.errors.length > 0 && <p className="text-sm text-gray-600">Corrija e aplique os filtros antes de salvar.</p>}
    {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-red-700 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>{message.text}</p>}
    {legacy.length > 0 && <div className="rounded border p-3 text-sm"><p>Há {legacy.length} favorito(s) salvo(s) neste navegador.</p><button type="button" disabled={busy || !loaded} onClick={importLegacy} className="min-h-11 underline disabled:opacity-50">Importar favoritos locais</button></div>}
    {loaded && !saved.length ? <p className="text-sm text-gray-600">Nenhum filtro favorito salvo na sua conta.</p> : <ul aria-label="Consultas favoritas" className="flex flex-wrap gap-3">{saved.map((item) => <li key={item.id} className="flex max-w-full items-center gap-1 rounded-lg border p-1"><Link href={item.href} aria-current={!filters.errors.length && item.href === current ? "page" : undefined} className="break-words rounded px-3 py-2 text-sm text-blue-700 hover:bg-muted dark:text-blue-300">{item.name}{!filters.errors.length && item.href === current && <span className="ml-2 text-xs text-gray-600">(atual)</span>}</Link><button type="button" disabled={busy} aria-label={`Remover favorito ${item.name}`} onClick={() => void remove(item)} className="min-h-11 shrink-0 rounded px-3 text-sm text-gray-600 hover:bg-muted disabled:opacity-50">Remover</button></li>)}</ul>}
  </section>;
}
