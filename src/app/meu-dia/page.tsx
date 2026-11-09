import Link from "next/link";
import TaskList from "@/components/TaskList";
import { getMyDayData } from "@/lib/my-day";
import { resolveTaskListParams } from "@/lib/task-list-params";

export const dynamic = "force-dynamic";

export default async function MyDayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = resolveTaskListParams({ focalPoint: params.focalPoint });
  if (filters.errors.length) return <main id="main-content" tabIndex={-1} className="p-8"><h1 className="text-2xl font-bold">Meu dia</h1><p role="alert">Ponto focal inválido. Limpe o filtro para continuar.</p><Link href="/meu-dia" className="underline">Limpar filtro</Link></main>;
  const data = await getMyDayData(filters.focalPoint);
  if (!data.currentUser) return <main id="main-content" tabIndex={-1} className="p-8"><h1 className="text-2xl font-bold">Meu dia</h1><p>Identifique-se na agenda para consultar as pendências.</p><Link href="/" className="underline">Voltar à agenda</Link></main>;
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 p-4 text-gray-900 sm:p-8">
    <h1 className="text-2xl font-bold">Meu dia</h1>
    <p>Pendências da sua unidade: vencidas, com prazo hoje e nos próximos sete dias. Abra uma tarefa para consultar detalhes e ações disponíveis.</p>
    <form action="/meu-dia" method="GET" aria-label="Filtrar meu dia" className="flex flex-wrap items-end gap-3 rounded-xl border bg-surface p-4">
      <div className="grow"><label htmlFor="day-focal" className="block text-sm font-medium">Ponto focal</label><select id="day-focal" name="focalPoint" defaultValue={filters.focalPoint ?? ""} className="mt-1 w-full rounded border p-2">
        <option value="">Todos os pontos focais</option>
        {filters.focalPoint !== null && !data.focalOptions.some((person) => person.id === filters.focalPoint) && <option value={filters.focalPoint}>Ponto focal indisponível nesta unidade</option>}
        {data.focalOptions.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}
      </select></div>
      <button className="rounded bg-blue-700 px-4 py-2 text-white" type="submit">Aplicar filtro</button><Link className="px-3 py-2 underline" href="/meu-dia">Limpar filtro</Link>
    </form>
    <nav aria-label="Grupos de pendências" className="grid gap-3 sm:grid-cols-3">{data.groups.map((group) => <a key={group.id} href={`#${group.id}`} className="rounded-xl border bg-surface p-4 hover:bg-muted"><span className="block font-medium">{group.title}</span><span className="text-2xl font-bold">{group.total}</span></a>)}</nav>
    {data.groups.map((group) => <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-4 space-y-3">
      <h2 id={`${group.id}-heading`} className="text-xl font-semibold">{group.title} ({group.total})</h2>
      {group.total === 0 ? <p className="rounded-lg border bg-surface p-4 text-gray-600">Nenhuma pendência neste grupo.</p> : <TaskList tasks={group.tasks} currentUser={data.currentUser!} employees={data.employees} label={group.title} />}
      {group.total > group.tasks.length && <p className="text-sm text-gray-600">Mostrando as primeiras {group.tasks.length} de {group.total} pendências.</p>}
      <Link href={group.href} className="inline-block py-2 text-blue-700 underline dark:text-blue-300">Ver {group.title.toLowerCase()} na lista</Link>
    </section>)}
  </main>;
}
