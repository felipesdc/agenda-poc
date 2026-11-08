import Link from "next/link";
import TaskList from "@/components/TaskList";
import { resolveTaskListParams } from "@/lib/task-list-params";
import { getValidationQueue, validationQueueUrl } from "@/lib/validation-queue";

export const dynamic = "force-dynamic";

export default async function ValidationQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { q, page } = resolveTaskListParams(await searchParams);
  const data = await getValidationQueue(q, page);
  if (!data) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl space-y-4 p-8"><h1 className="text-2xl font-bold">Acesso restrito</h1><p>A fila de validação é exclusiva do gestor da unidade.</p><Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link></main>;
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl space-y-6 p-4 text-gray-900 sm:p-8">
    <Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link>
    <h1 className="text-2xl font-bold">Fila de validação</h1>
    <p>Tarefas concluídas e ativas da sua unidade, de todos os períodos. Abra cada tarefa, confira os detalhes e o histórico e selecione Validar.</p>
    <p className="text-sm text-gray-600">As conclusões mais antigas aparecem primeiro. Registros legados sem data de conclusão aparecem no início, ordenados pelo prazo.</p>
    <form action="/validacoes" method="GET" key={q} aria-label="Buscar na fila de validação" className="flex flex-wrap items-end gap-3 rounded-xl border bg-surface p-4">
      <div className="min-w-0 flex-1"><label htmlFor="validation-search" className="block text-sm font-medium">Título ou descrição</label><input id="validation-search" aria-describedby="validation-search-help" name="q" type="search" maxLength={120} defaultValue={q} className="mt-1 w-full rounded-lg border p-2" /><p id="validation-search-help" className="mt-1 text-xs text-gray-600">Busca com ou sem acentos e sem distinção entre maiúsculas e minúsculas latinas.</p></div>
      <button type="submit" className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-white">Buscar</button>
      <Link href="/validacoes" className="px-2 py-3 text-sm text-blue-700 dark:text-blue-300 underline">Limpar busca</Link>
    </form>
    <p role="status">{data.total} {data.total === 1 ? "tarefa aguardando validação" : "tarefas aguardando validação"} · Página {data.page} de {data.pages}{q && " · busca aplicada"}</p>
    <TaskList tasks={data.tasks} currentUser={data.currentUser} employees={[]} validationQueue />
    <nav aria-label="Paginação da fila de validação" className="flex gap-4">
      {data.page > 1 && <Link href={validationQueueUrl(q, data.page - 1)} className="text-blue-700 dark:text-blue-300 underline">Página anterior</Link>}
      {data.page < data.pages && <Link href={validationQueueUrl(q, data.page + 1)} className="text-blue-700 dark:text-blue-300 underline">Próxima página</Link>}
    </nav>
  </main>;
}
