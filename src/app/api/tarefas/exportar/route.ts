import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolveTaskListParams } from "@/lib/task-list-params";
import { taskListWhere } from "@/lib/task-list";
import { MAX_CSV_TASKS, tasksToCsv } from "@/lib/task-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function error(message: string, status: number) { return Response.json({ message }, { status, headers: privateHeaders }); }

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return error("Identifique-se novamente para exportar.", 401);
    const search = new URL(request.url).searchParams;
    const params: Record<string, string | string[]> = {};
    for (const key of new Set(search.keys())) {
      const values = search.getAll(key); params[key] = values.length === 1 ? values[0] : values;
    }
    const filters = resolveTaskListParams(params);
    if (filters.errors.length) return error("Corrija os filtros antes de exportar.", 400);
    const where = taskListWhere(filters, actor.unitId);
    if (await prisma.task.count({ where }) > MAX_CSV_TASKS) return error(`A exportação permite até ${MAX_CSV_TASKS} tarefas. Refine os filtros.`, 413);
    const tasks = await prisma.task.findMany({ where, take: MAX_CSV_TASKS + 1,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      select: { title: true, description: true, dueDate: true, status: true, frequency: true, focalPoints: { select: { name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] } },
    });
    if (tasks.length > MAX_CSV_TASKS) return error(`A exportação permite até ${MAX_CSV_TASKS} tarefas. Refine os filtros.`, 413);
    return new Response(tasksToCsv(tasks), { headers: {
      ...privateHeaders, "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tarefas-${new Date().toISOString().slice(0,10)}.csv"`,
    } });
  } catch { return error("Não foi possível exportar. Tente novamente.", 500); }
}
