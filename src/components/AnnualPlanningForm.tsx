"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createAnnualPlan } from "@/actions/annual-planning";
import { frequencyLabels } from "@/lib/task-frequency";

type Source = { id: string; title: string; description: string | null; dueDate: Date; completedAt: Date | null; frequency: keyof typeof frequencyLabels; status: string; archivedAt: Date | null; focalPoints: { id: number; name: string }[]; authorName: string; previouslyPlanned: boolean; recurrenceInTargetYear: boolean };
type PlanRequest = { requestId: string; sourceYear: number; targetYear: number; author: string; items: { id: string; dueDate: string }[] };
function requestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export default function AnnualPlanningForm({ tasks, sourceYear, targetYear, author, canCreate, restartHref }: { tasks: Source[]; sourceYear: number; targetYear: number; author: string; canCreate: boolean; restartHref: string }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState<PlanRequest | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const inFlight = useRef(false);
  const count = Object.keys(selected).length;
  async function send(request: PlanRequest) {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setResult(null);
    try { setResult(await createAnnualPlan(request)); }
    catch { setResult({ success: false, message: "Não foi possível confirmar o resultado. Tente novamente com os mesmos dados." }); }
    finally { setPending(false); inFlight.current = false; }
  }
  function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!count || submitted || inFlight.current) return;
    let id: string;
    try { id = requestId(); } catch { setResult({ success: false, message: "Não foi possível iniciar a solicitação neste navegador." }); return; }
    const request = { requestId: id, sourceYear, targetYear, author, items: Object.entries(selected).map(([id, dueDate]) => ({ id, dueDate })) };
    setSubmitted(request); void send(request);
  }
  if (!tasks.length) return <p className="rounded-lg border bg-surface p-4">Nenhuma tarefa concluída corresponde à consulta.</p>;
  return <form onSubmit={start} aria-label="Planejar tarefas selecionadas" aria-busy={pending} className="space-y-4">
    <p className="text-sm text-gray-600">Selecione até 25 tarefas desta página e escolha um prazo em {targetYear} para cada uma. A seleção vale para esta página.</p>
    <ul className="space-y-3">{tasks.map((task) => {
      const checked = Object.hasOwn(selected, task.id);
      return <li key={task.id} className="rounded-lg border bg-surface p-4"><div className="flex flex-wrap items-start gap-3">
        <label className="flex min-h-11 flex-1 items-start gap-3"><input type="checkbox" checked={checked} disabled={!canCreate || !!submitted} onChange={(event) => setSelected((current) => { const next = { ...current }; if (event.target.checked) next[task.id] = ""; else delete next[task.id]; return next; })} className="mt-1 h-5 w-5 shrink-0" /><span className="min-w-0"><span className="block break-words font-semibold">{task.title}</span><span className="block text-sm text-gray-600">Concluída em {task.completedAt ? format(new Date(task.completedAt), "dd/MM/yyyy") : "data não registrada"} · Por {task.authorName}</span><span className="block text-sm text-gray-600">Prazo original: {format(new Date(task.dueDate), "dd/MM/yyyy")} · {frequencyLabels[task.frequency]}{task.archivedAt ? " · Arquivada" : ""}</span><span className="block text-sm text-gray-600">Pontos focais: {task.focalPoints.length ? task.focalPoints.map((person) => person.name).join(", ") : "Nenhum"}</span></span></label>
        {checked && <div><label htmlFor={`due-${task.id}`} className="block text-sm font-medium">Novo prazo para {task.title}</label><input id={`due-${task.id}`} type="date" required min={`${targetYear}-01-01`} max={`${targetYear}-12-31`} value={selected[task.id]} disabled={!!submitted} onChange={(event) => setSelected((current) => ({ ...current, [task.id]: event.target.value }))} className="mt-1 min-h-11 rounded border p-2" /></div>}
      </div>{task.description && <details className="mt-2 text-sm"><summary className="cursor-pointer">Ver descrição</summary><p className="mt-2 whitespace-pre-wrap break-words">{task.description}</p></details>}{(task.previouslyPlanned || task.recurrenceInTargetYear) && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{task.previouslyPlanned && "Já existe uma cópia criada pelo planejamento para este ano. "}{task.recurrenceInTargetYear && "A recorrência já gerou uma próxima tarefa com prazo neste ano."} Confira antes de criar outra.</p>}</li>;
    })}</ul>
    {!canCreate && <p>Seu perfil permite consultar o levantamento; a criação de tarefas é restrita a gestores e operadores.</p>}
    {canCreate && !submitted && <button type="submit" disabled={!count} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Criar {count} tarefa(s) em {targetYear}</button>}
    {result && <div role={result.success ? "status" : "alert"} className="rounded border bg-surface p-4"><p>{result.message}</p>{!result.success && submitted && <><p className="mt-2 text-sm">Uma nova tentativa usa os mesmos dados para evitar cópias duplicadas. Para alterar a seleção, consulte novamente esta página e confira as tarefas já criadas.</p><button type="button" disabled={pending} onClick={() => void send(submitted)} className="mt-2 min-h-11 rounded border px-4 disabled:opacity-50">Tentar novamente</button></>}</div>}
    {pending && <p role="status">Criando tarefas…</p>}
    {result?.success && <div className="flex flex-wrap gap-4"><Link href={`/tarefas?from=${targetYear}-01-01&to=${targetYear}-12-31&status=PENDING`} className="py-2 text-blue-700 underline dark:text-blue-300">Ver tarefas do ano de destino</Link><a href={restartHref} className="py-2 text-blue-700 underline dark:text-blue-300">Planejar outro lote</a></div>}
  </form>;
}
