import Link from "next/link";
import { format } from "date-fns";
import TaskList from "@/components/TaskList";
import RefreshPendingButton from "@/components/RefreshPendingButton";
import { getPendingCenterData, pendingCenterUrl, pendingLabels, resolvePendingParams } from "@/lib/pending-center";

export const dynamic = "force-dynamic";

export default async function PendingCenterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { category, page } = resolvePendingParams(await searchParams);
  const data = await getPendingCenterData(category, page);
  if (!data || data.restricted) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-4 p-8"><h1 className="text-2xl font-bold">Central de pendências</h1><p>{data?.restricted ? "A consulta de validações é exclusiva do gestor da unidade." : "Identifique-se na agenda para consultar as pendências."}</p><Link href={data?.restricted ? "/pendencias" : "/"} className="underline">{data?.restricted ? "Ver pendências de prazo" : "Voltar à agenda"}</Link></main>;
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 p-4 text-gray-900 sm:p-8">
    <h1 className="text-2xl font-bold">Central de pendências</h1>
    <p>Alertas da sua unidade em todos os períodos: tarefas vencidas, prazo hoje e nos próximos 15 dias{data.currentUser.role === "ADMIN" ? ", além das conclusões aguardando sua validação" : ""}.</p>
    <div className="flex flex-wrap items-center gap-3"><RefreshPendingButton /><p className="text-xs text-gray-600">Atualizado em {format(data.updatedAt, "dd/MM/yyyy 'às' HH:mm")}. Atualize para conferir mudanças de outras pessoas.</p></div>
    <nav aria-label="Categorias de pendências" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.counts.map((group) => <Link key={group.id} href={pendingCenterUrl(group.id)} aria-current={category === group.id ? "page" : undefined} className={`rounded-xl border p-4 hover:bg-muted ${category === group.id ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40" : "bg-surface"}`}><span className="block text-sm font-medium">{group.label}</span><span className="text-2xl font-bold">{group.count}</span></Link>)}</nav>
    <section aria-labelledby="pending-results" className="space-y-4">
      <h2 id="pending-results" className="text-xl font-semibold">{pendingLabels[category]}</h2>
      <p role="status">{data.total} {data.total === 1 ? "pendência" : "pendências"} · Página {data.page} de {data.pages}</p>
      <p className="text-sm text-gray-600">Ordenadas pelo prazo, do mais antigo ao mais próximo. Tarefas arquivadas e validadas ficam fora da central. Os próximos 15 dias começam amanhã.</p>
      {data.total === 0 ? <p className="rounded-lg border bg-surface p-4">Nenhuma pendência nesta categoria.</p> : <TaskList tasks={data.tasks} currentUser={data.currentUser} employees={data.employees} label={pendingLabels[category]} validationQueue={category === "validation"} />}
      <nav aria-label="Paginação da central de pendências" className="flex gap-4">
        {data.page > 1 && <Link href={pendingCenterUrl(category, data.page - 1)} className="py-2 text-blue-700 underline dark:text-blue-300">Página anterior</Link>}
        {data.page < data.pages && <Link href={pendingCenterUrl(category, data.page + 1)} className="py-2 text-blue-700 underline dark:text-blue-300">Próxima página</Link>}
      </nav>
    </section>
    {data.currentUser.role === "ADMIN" && <Link href="/validacoes" className="inline-block py-2 text-blue-700 underline dark:text-blue-300">Abrir fila de validação por ordem de conclusão</Link>}
  </main>;
}
