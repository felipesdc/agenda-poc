import Link from "next/link";
import AnnualPlanningForm from "@/components/AnnualPlanningForm";
import { annualPlanUrl, getAnnualPlanData, resolveAnnualPlanParams } from "@/lib/annual-planning";
import { canWriteTasks } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export default async function AnnualPlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = resolveAnnualPlanParams(await searchParams);
  const data = await getAnnualPlanData(params);
  if (!data) return <main id="main-content" tabIndex={-1} className="p-8"><h1 className="text-2xl font-bold">Planejamento anual</h1><p>Identifique-se para consultar o planejamento.</p><Link href="/" className="underline">Voltar à agenda</Link></main>;
  const authorExists = data.authors.some((person) => person.id === params.author);
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 p-4 text-gray-900 sm:p-8">
    <h1 className="text-2xl font-bold">Planejamento anual</h1>
    <p>Encontre tarefas concluídas em um ano e prepare cópias para outro. O ano de referência considera a data de conclusão, independentemente do prazo original.</p>
    <form action="/planejamento-anual" method="GET" aria-label="Consultar tarefas concluídas" className="grid gap-4 rounded-xl border bg-surface p-4 sm:grid-cols-3">
      <div><label htmlFor="plan-source" className="block text-sm font-medium">Ano da conclusão</label><input id="plan-source" name="sourceYear" type="number" min={1900} max={2100} required defaultValue={params.sourceYear} className="mt-1 w-full rounded border p-2" /></div>
      <div><label htmlFor="plan-target" className="block text-sm font-medium">Ano de destino</label><input id="plan-target" name="targetYear" type="number" min={1900} max={2100} required defaultValue={params.targetYear} className="mt-1 w-full rounded border p-2" /></div>
      <div><label htmlFor="plan-author" className="block text-sm font-medium">Quem concluiu</label><select id="plan-author" name="author" defaultValue={params.author} className="mt-1 w-full rounded border p-2"><option value="">Todas as pessoas da unidade</option>{params.author && !authorExists && <option value={params.author}>Usuário indisponível nesta unidade</option>}{data.authors.map((person) => <option key={person.id} value={person.id}>{person.name}{person.id === data.currentUser.id ? " (eu)" : ""}{!person.isActive ? " · desativado" : ""}</option>)}</select></div>
      <div className="sm:col-span-3"><button className="min-h-11 rounded bg-blue-700 px-4 py-2 text-white">Consultar tarefas</button></div>
    </form>
    <p className="text-sm text-gray-600">Inclui tarefas concluídas, validadas e arquivadas da unidade com data de conclusão registrada. Dados legados sem essa data ficam fora da consulta. O filtro de pessoa usa o histórico de conclusão.</p>
    <p className="text-sm text-gray-600">As cópias serão pendentes, com título, descrição, periodicidade e pontos focais. Histórico, comentários e etapas não são copiados. A periodicidade mantida poderá gerar nova ocorrência após validação.</p>
    <p role="status">{data.total} tarefa(s) encontrada(s) · Página {data.page} de {data.pages}</p>
    <AnnualPlanningForm key={annualPlanUrl(params, data.page)} tasks={data.tasks} sourceYear={params.sourceYear} targetYear={params.targetYear} author={params.author} canCreate={canWriteTasks(data.currentUser)} restartHref={annualPlanUrl(params, data.page)} />
    <nav aria-label="Paginação do planejamento" className="flex flex-wrap gap-4">{data.page > 1 && <Link href={annualPlanUrl(params, data.page - 1)} className="py-2 text-blue-700 underline dark:text-blue-300">Página anterior</Link>}{data.page < data.pages && <Link href={annualPlanUrl(params, data.page + 1)} className="py-2 text-blue-700 underline dark:text-blue-300">Próxima página</Link>}</nav>
  </main>;
}
