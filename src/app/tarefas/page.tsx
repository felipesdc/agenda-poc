import ExportTasksButton from "@/components/ExportTasksButton";
import Link from "next/link";
import { getTaskListData } from "@/lib/task-list";
import { resolveTaskListParams, taskListUrl, taskExportUrl } from "@/lib/task-list-params";
import TaskList from "@/components/TaskList";

export const dynamic = "force-dynamic";

export default async function TaskListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = resolveTaskListParams(await searchParams);
  const data = await getTaskListData(filters);
  if (!data.currentUser) return <main id="main-content" tabIndex={-1} className="p-8"><h1 className="text-2xl font-bold">Lista de tarefas</h1><p className="my-4">Identifique-se na agenda para consultar as tarefas.</p><Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link></main>;
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 p-4 text-gray-900 sm:p-8">
    <Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link>
    <h1 className="text-2xl font-bold">Lista de tarefas</h1>
    <p>Consulte tarefas ativas da sua unidade em todos os períodos. Abra uma tarefa para ver detalhes e ações disponíveis.</p>
    <form action="/tarefas" method="GET" key={taskListUrl(filters)} className="grid gap-4 rounded-xl border bg-surface p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_14rem]" aria-label="Buscar e filtrar tarefas">
      <div><label htmlFor="task-search" className="block text-sm font-medium">Título ou descrição</label><input id="task-search" aria-describedby="task-search-help" type="search" name="q" maxLength={120} defaultValue={filters.q} className="mt-1 w-full rounded border p-2" /><p id="task-search-help" className="mt-1 text-xs text-gray-600">Busque com ou sem acentos. Ex.: relatorio encontra relatório.</p></div>
      <div><label htmlFor="task-status" className="block text-sm font-medium">Estado</label><select id="task-status" name="status" defaultValue={filters.status} className="mt-1 w-full rounded border p-2"><option value="ALL">Todos</option><option value="PENDING">Pendentes</option><option value="COMPLETED">Concluídas</option><option value="VALIDATED">Validadas</option></select></div>
      <div className="md:col-span-2"><label htmlFor="task-focal" className="block text-sm font-medium">Ponto focal</label><select id="task-focal" name="focalPoint" defaultValue={filters.focalPoint ?? ""} className="mt-1 w-full rounded border p-2">
        <option value="">Todos os pontos focais</option>
        {filters.focalPoint !== null && !data.focalOptions.some((employee) => employee.id === filters.focalPoint) && <option value={filters.focalPoint}>Ponto focal indisponível nesta unidade</option>}
        {data.focalOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.id}</option>)}
      </select><p className="mt-1 text-xs text-gray-600">Pontos focais vinculados a tarefas ativas da sua unidade.</p></div>
      <fieldset className="grid gap-3 sm:grid-cols-2 md:col-span-2"><legend className="mb-2 text-sm font-medium">Intervalo de prazo (inclusive)</legend>
        <div><label htmlFor="task-from" className="block text-sm">Prazo a partir de</label><input id="task-from" name="from" type="date" defaultValue={filters.from} aria-describedby="date-filter-help" className="mt-1 w-full rounded border p-2" /></div>
        <div><label htmlFor="task-to" className="block text-sm">Prazo até</label><input id="task-to" name="to" type="date" defaultValue={filters.to} aria-describedby="date-filter-help" className="mt-1 w-full rounded border p-2" /></div>
      </fieldset>
      <p id="date-filter-help" className="text-xs text-gray-600 md:col-span-2">Você pode preencher apenas uma data. As duas datas incluem todo o dia e se combinam com os demais filtros.</p>
      {filters.errors.length > 0 && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300 md:col-span-2"><ul>{filters.errors.map((error) => <li key={error}>{error}</li>)}</ul><p>A busca de tarefas não foi executada. Corrija os filtros e aplique novamente.</p></div>}
      <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="overdue" value="true" defaultChecked={filters.overdue} />Todas as vencidas (somente pendentes)</label>
      <p className="text-sm text-gray-600 md:col-span-2">A opção de vencidas prioriza pendências com prazo anterior a hoje, de qualquer mês ou ano, respeitando também o ponto focal e o intervalo informados.</p>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2"><button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">Aplicar filtros</button><Link href="/tarefas" className="text-blue-700 dark:text-blue-300 underline">Limpar filtros</Link></div>
    </form>
    <p role="status">{data.total} {data.total === 1 ? "tarefa encontrada" : "tarefas encontradas"} · Página {data.page} de {data.pages}</p>
    {!filters.errors.length && <ExportTasksButton href={taskExportUrl(filters)} />}
    <TaskList tasks={data.tasks} currentUser={data.currentUser} employees={data.employees} />
    <nav aria-label="Paginação das tarefas" className="flex gap-4">
      {data.page > 1 && <Link href={taskListUrl(filters, data.page - 1)} className="text-blue-700 dark:text-blue-300 underline">Página anterior</Link>}
      {data.page < data.pages && <Link href={taskListUrl(filters, data.page + 1)} className="text-blue-700 dark:text-blue-300 underline">Próxima página</Link>}
    </nav>
  </main>;
}
