import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import DashboardCalendar from "@/components/DashboardCalendar";
import StatusCards from "@/components/StatusCards";
import ArchiveFilter from "@/components/ArchiveFilter";
import ArchivedTaskList from "@/components/ArchivedTaskList";
import TaskForm from "@/components/TaskForm";
import DateFilter from "@/components/DateFilter";
import YearView from "@/components/YearView";
import UserSwitcher from "@/components/UserSwitcher";
import { isDemoModeEnabled } from "@/lib/auth";
import { getAgendaData } from "@/lib/tasks";
import { canWriteTasks } from "@/lib/permissions";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const now = new Date();
  const archived = resolvedParams.archived === "true";
  const view = resolvedParams.view === "year" ? "year" : "month";

  const month =
    resolvedParams.month !== undefined
      ? Number(resolvedParams.month)
      : now.getMonth();

  const year =
    resolvedParams.year !== undefined
      ? Number(resolvedParams.year)
      : now.getFullYear();

  const referenceDate = new Date(year, month, 1);

  const rangeStart =
    view === "month" ? startOfMonth(referenceDate) : startOfYear(referenceDate);
  const rangeEnd =
    view === "month" ? endOfMonth(referenceDate) : endOfYear(referenceDate);

  const { currentUser, tasks, employees: allEmployees } = await getAgendaData(rangeStart, rangeEnd, archived);
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-2xl font-bold text-gray-900">Agenda da Unidade</h1>
        <p className="mt-4 text-gray-700">Identifique-se para consultar a agenda.</p>
        {isDemoModeEnabled() && <UserSwitcher currentUser={null} />}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Agenda da Unidade
          </h1>
        </header>
        <ArchiveFilter />
        {archived ? (
          <ArchivedTaskList tasks={tasks} currentUser={currentUser} />
        ) : (
          <>
            <DateFilter />
            <StatusCards tasks={tasks} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2">
                {view === "month" ? (
                  <DashboardCalendar tasks={tasks} currentDate={referenceDate} currentUser={currentUser} employees={allEmployees} />
                ) : (
                  <YearView tasks={tasks} year={year} />
                )}
              </div>
              {canWriteTasks(currentUser) && <div><TaskForm employees={allEmployees} /></div>}
            </div>
          </>
        )}
      </div>
      {isDemoModeEnabled() && <UserSwitcher currentUser={currentUser} />}
    </main>
  );
}
