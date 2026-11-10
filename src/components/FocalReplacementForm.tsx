"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { applyFocalReplacement, previewFocalReplacement } from "@/actions/focal-replacement";
import type { FocalReplacementPreview } from "@/lib/focal-replacement";

type Person = { id: number; name: string };
export default function FocalReplacementForm({ sources, destinations }: { sources: Person[]; destinations: Person[] }) {
  const [source, setSource] = useState(""); const [destination, setDestination] = useState("");
  const [preview, setPreview] = useState<FocalReplacementPreview | null>(null);
  const [pending, setPending] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const inFlight = useRef(false); const router = useRouter();
  async function inspect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    inFlight.current = true; setPending("preview"); setMessage(null); setPreview(null);
    try { const result = await previewFocalReplacement(Number(source), Number(destination)); if (result.success && result.preview) setPreview(result.preview); else setMessage({ text: result.message, error: true }); }
    catch { setMessage({ text: "Não foi possível carregar a prévia. Tente novamente.", error: true }); }
    finally { inFlight.current = false; setPending(null); }
  }
  async function apply() {
    if (!preview || inFlight.current) return;
    inFlight.current = true; setPending("apply"); setMessage(null);
    try {
      const result = await applyFocalReplacement(preview.source.id, preview.destination.id, preview.digest);
      setMessage({ text: `${result.message}${result.success && result.remaining ? ` Restam ${result.remaining} tarefa(s); consulte novamente para continuar.` : ""}`, error: !result.success });
      setPreview(null);
      if (result.success) { if (!result.remaining) setSource(""); router.refresh(); }
    } catch { setPreview(null); setMessage({ text: "Não foi possível confirmar o resultado. Atualize a prévia e confira as tarefas antes de tentar novamente.", error: true }); }
    finally { inFlight.current = false; setPending(null); }
  }
  return <div className="space-y-6">
    <form onSubmit={inspect} aria-label="Consultar substituição" className="grid gap-4 rounded-xl border bg-surface p-4 sm:grid-cols-2">
      <div><label htmlFor="focal-source" className="block text-sm font-medium">Ponto focal atual</label><select id="focal-source" required value={source} disabled={!!pending} onChange={(event) => { setSource(event.target.value); setPreview(null); setMessage(null); }} className="mt-1 min-h-11 w-full rounded border p-2"><option value="">Selecione uma pessoa</option>{sources.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}</select></div>
      <div><label htmlFor="focal-destination" className="block text-sm font-medium">Novo ponto focal</label><select id="focal-destination" required value={destination} disabled={!!pending} onChange={(event) => { setDestination(event.target.value); setPreview(null); setMessage(null); }} className="mt-1 min-h-11 w-full rounded border p-2"><option value="">Selecione uma pessoa</option>{destinations.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}</select></div>
      <div className="sm:col-span-2"><button type="submit" disabled={!!pending || !source || !destination || source === destination} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{pending === "preview" ? "Consultando…" : "Ver tarefas afetadas"}</button>{source && destination && source === destination && <p className="mt-2 text-sm text-gray-600">Escolha pessoas diferentes.</p>}</div>
    </form>
    {message && <p role={message.error ? "alert" : "status"} className="rounded-lg border bg-surface p-4">{message.text}</p>}
    {preview && <section aria-labelledby="replacement-preview" className="space-y-4 rounded-xl border bg-surface p-4 sm:p-6">
      <h2 id="replacement-preview" className="text-lg font-semibold">Prévia da substituição</h2>
      <p><strong>{preview.source.name}</strong> → <strong>{preview.destination.name}</strong></p>
      <p role="status">{preview.total} tarefa(s) elegível(eis). {preview.total > preview.tasks.length ? `Este lote atualizará as primeiras ${preview.tasks.length}; depois, consulte novamente para continuar.` : `Este lote atualizará ${preview.tasks.length}.`}</p>
      <p className="text-sm text-gray-600">Prazos a partir de {format(new Date(preview.from), "dd/MM/yyyy")}, incluindo hoje. Outros pontos focais são preservados. Caso a pessoa substituta já esteja em uma tarefa, ela permanecerá uma única vez.</p>
      {!preview.tasks.length ? <p>Nenhuma tarefa pendente futura encontrada para essa pessoa.</p> : <><div className="max-h-96 overflow-auto rounded border"><ul aria-label="Tarefas que serão atualizadas" className="divide-y">{preview.tasks.map((task) => <li key={task.id} className="space-y-1 p-3"><p className="break-words font-medium">{task.title}</p><p className="text-sm text-gray-600">Prazo: {format(new Date(task.dueDate), "dd/MM/yyyy")}</p><p className="text-sm text-gray-600">Pontos focais atuais: {task.focalPoints.map((person) => person.name).join(", ")}</p>{task.focalPoints.some((person) => person.id === preview.destination.id) && <p className="text-sm text-gray-600">A pessoa substituta já participa desta tarefa.</p>}</li>)}</ul></div>
      <button type="button" onClick={() => void apply()} disabled={!!pending} className="min-h-11 rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-50">{pending === "apply" ? "Atualizando…" : `Confirmar substituição em ${preview.tasks.length} tarefa(s)`}</button></>}
    </section>}
  </div>;
}
