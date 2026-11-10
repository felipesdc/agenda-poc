"use client";
import { useEffect, useId, useState } from "react";
import { changeChecklist, getChecklist, type ChecklistItem } from "@/actions/checklist";

export default function TaskChecklist({ taskId, editable }: { taskId: string; editable: boolean }) {
  const id = useId(); const [open, setOpen] = useState(false); const [items, setItems] = useState<ChecklistItem[] | null>(null); const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [version, setVersion] = useState(0);
  useEffect(() => { if (!open) return; let live = true; void getChecklist(taskId).then((result) => { if (live) { if (result.success) { setItems(result.items); setError(""); } else setError("Não foi possível carregar as etapas."); } }).catch(() => { if (live) setError("Não foi possível carregar as etapas."); }); return () => { live = false; }; }, [open, taskId, version]);
  async function update(change: Parameters<typeof changeChecklist>[1]) {
    if (busy) return; setBusy(true); setError("");
    try { const result = await changeChecklist(taskId, change); if (result.success) { if (change.operation === "add") setTitle(""); setVersion((v) => v + 1); } else setError(result.message); } catch { setError("Não foi possível atualizar as etapas."); } finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t pt-4"><h4><button type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(!open)} className="min-h-11 rounded px-2 text-sm font-semibold hover:bg-muted">{open ? "Ocultar etapas" : "Ver etapas"}</button></h4><div id={`${id}-content`} hidden={!open} className="space-y-3">
    {error && <p role="alert">{error} <button type="button" onClick={() => setVersion((v) => v + 1)} className="underline">Tentar novamente</button></p>}
    {items ? <><p className="text-sm text-gray-600">{items.filter((item) => item.done).length} de {items.length} etapas concluídas</p><ul className="space-y-2">{items.map((item) => <li key={item.id} className="flex items-center gap-3"><label className="flex min-h-11 grow items-center gap-2"><input type="checkbox" checked={item.done} disabled={!editable || busy} onChange={(event) => void update({ operation: "toggle", id: item.id, done: event.target.checked })} /><span className="break-words">{item.title}</span></label>{editable && <button type="button" disabled={busy} onClick={() => void update({ operation: "remove", id: item.id })} aria-label={`Remover etapa ${item.title}`} className="min-h-11 rounded border px-3">Remover</button>}</li>)}</ul></> : !error && <p>Carregando etapas…</p>}
    {editable && <form onSubmit={(event) => { event.preventDefault(); void update({ operation: "add", title }); }} className="flex flex-wrap gap-2"><label htmlFor={`${id}-title`} className="sr-only">Nova etapa</label><input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required placeholder="Nova etapa" className="min-w-0 grow rounded border p-2" /><button disabled={busy || !title.trim()} className="min-h-11 rounded bg-blue-700 px-4 text-white disabled:opacity-50">Adicionar etapa</button></form>}
  </div></section>;
}
