import Link from "next/link";
import { endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCalendarParams } from "@/lib/calendar-params";

export const dynamic = "force-dynamic";
export default async function SummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getCurrentUser();
  if (!actor) return <main id="main-content" tabIndex={-1} className="p-8"><h1 className="text-2xl font-bold">Resumo da unidade</h1><p>Identifique-se para consultar o resumo.</p><Link className="underline" href="/">Voltar à agenda</Link></main>;
  const { month, year } = resolveCalendarParams(await searchParams); const date = new Date(year, month, 1);
  const from = startOfMonth(date); const to = endOfMonth(date); const today = startOfDay(new Date());
  const scope = { unitId: actor.unitId, archivedAt: null, dueDate: { gte: from, lte: to } };
  const [all, completed, validated, overdue] = await Promise.all([
    prisma.task.count({ where: scope }),
    prisma.task.count({ where: { ...scope, status: "COMPLETED" } }),
    prisma.task.count({ where: { ...scope, status: "VALIDATED" } }),
    prisma.task.count({ where: { ...scope, status: "PENDING", dueDate: { ...scope.dueDate, lt: today } } }),
  ]);
  const base = new URLSearchParams({ from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") });
  const items = [
    { label: "Todas as tarefas", count: all, extra: {} },
    { label: "Aguardando validação", count: completed, extra: { status: "COMPLETED" } },
    { label: "Validadas", count: validated, extra: { status: "VALIDATED" } },
    { label: "Vencidas", count: overdue, extra: { overdue: "true" } },
  ];
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-6 p-4 text-gray-900 sm:p-8"><h1 className="text-2xl font-bold">Resumo da unidade</h1><p>Indicadores das tarefas ativas por mês de prazo, incluindo concluídas e validadas. Tarefas arquivadas ficam fora do resumo.</p>
    <form method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border bg-surface p-4"><div><label htmlFor="summary-month" className="block text-sm">Mês</label><select id="summary-month" name="month" defaultValue={month} className="mt-1 rounded border p-2">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{String(i + 1).padStart(2, "0")}</option>)}</select></div><div><label htmlFor="summary-year" className="block text-sm">Ano</label><input id="summary-year" type="number" name="year" min={1900} max={2100} defaultValue={year} className="mt-1 w-28 rounded border p-2" /></div><button className="min-h-11 rounded bg-blue-700 px-4 text-white">Consultar período</button></form>
    <p className="font-medium">Prazos de {format(from, "dd/MM/yyyy")} a {format(to, "dd/MM/yyyy")}</p><section aria-label="Indicadores da unidade" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => { const params = new URLSearchParams(base); for (const [key, value] of Object.entries(item.extra)) if (value) params.set(key, value); return <Link key={item.label} href={`/tarefas?${params}`} className="rounded-xl border bg-surface p-5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-blue-600"><span className="block text-sm">{item.label}</span><span className="mt-1 block text-3xl font-bold">{item.count}</span><span className="mt-2 block text-sm text-blue-700 dark:text-blue-300">Ver tarefas</span></Link>; })}</section>
  </main>;
}
