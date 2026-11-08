import Link from "next/link";
import { getTaskListData } from "@/lib/task-list";
import { resolveTaskListParams, taskListUrl } from "@/lib/task-list-params";
import TaskList from "@/components/TaskList";

export const dynamic = "force-dynamic";

export default async function TaskListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = resolveTaskListParams(await searchParams);
  const data = await getTaskListData(filters);
  if (!data.currentUser) return <main id="main-content" className="p-8"><h1 className="text-2xl font-bold">Lista de tarefas</h1><p className="my-4">Identifique-se na agenda para consultar as tarefas.</p><Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link></main>;
  return <main id="main-content" className="mx-auto max-w-6xl space-y-6 p-4 text-gray-900 sm:p-8">
    <Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link>
    <h1 className="text-2xl font-bold">Lista de tarefas</h1>
    <p>Consulte tarefas ativas da sua unidade em todos os períodos. Abra uma tarefa para ver detalhes e ações disponíveis.</p>
    <form action="/tarefas" method="GET" key={taskListUrl(filters)} className="grid gap-4 rounded-xl border bg-surface p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_14rem]" aria-label="Buscar e filtrar tarefas">
      <div><label htmlFor="task-search" className="block text-sm font-medium">Título ou descrição</label><input id="task-search" type="search" name="q" maxLength={120} defaultValue={filters.q} className="mt-1 w-full rounded border p-2" /></div>
      <div><label htmlFor="task-status" className="block text-sm font-medium">Estado</label><select id="task-status" name="status" defaultValue={filters.status} className="mt-1 w-full rounded border p-2"><option value="ALL">Todos</option><option value="PENDING">Pendentes</option><option value="COMPLETED">Concluídas</option><option value="VALIDATED">Validadas</option></select></div>
      <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="overdue" value="true" defaultChecked={filters.overdue} />Todas as vencidas (somente pendentes)</label>
      <p className="text-sm text-gray-600 md:col-span-2">A opção de vencidas prioriza pendências com prazo anterior a hoje, de qualquer mês ou ano, mantendo a busca por texto.</p>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2"><button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">Aplicar filtros</button><Link href="/tarefas" className="text-blue-700 dark:text-blue-300 underline">Limpar filtros</Link></div>
    </form>
    <p role="status">{data.total} {data.total === 1 ? "tarefa encontrada" : "tarefas encontradas"} · Página {data.page} de {data.pages}</p>
    <TaskList tasks={data.tasks} currentUser={data.currentUser} employees={data.employees} />
    <nav aria-label="Paginação das tarefas" className="flex gap-4">
      {data.page > 1 && <Link href={taskListUrl(filters, data.page - 1)} className="text-blue-700 dark:text-blue-300 underline">Página anterior</Link>}
      {data.page < data.pages && <Link href={taskListUrl(filters, data.page + 1)} className="text-blue-700 dark:text-blue-300 underline">Próxima página</Link>}
    </nav>
  </main>;
}
