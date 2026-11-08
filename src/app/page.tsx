import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { isPasswordAuthConfigured } from "@/lib/password-auth";
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
import { resolveCalendarParams } from "@/lib/calendar-params";
import { canWriteTasks } from "@/lib/permissions";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const { month, year, view, archived } = resolveCalendarParams(resolvedParams);

  const referenceDate = new Date(year, month, 1);

  const rangeStart =
    view === "month" ? startOfMonth(referenceDate) : startOfYear(referenceDate);
  const rangeEnd =
    view === "month" ? endOfMonth(referenceDate) : endOfYear(referenceDate);

  const { currentUser, tasks, employees: allEmployees } = await getAgendaData(rangeStart, rangeEnd, archived);
  if (!currentUser) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-50 px-4 py-6 pb-32 sm:px-8">
        <h1 className="text-2xl font-bold text-gray-900">Agenda da Unidade</h1>
        <p className="mt-4 text-gray-700">Identifique-se para consultar a agenda.</p>
        {isPasswordAuthConfigured() && <Link href="/login" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-white">Entrar com e-mail e senha</Link>}
        {isDemoModeEnabled() && <UserSwitcher currentUser={null} />}
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-50 px-4 py-6 pb-32 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Agenda da Unidade
          </h1>
          <p className="mt-2 text-sm text-gray-600">Acompanhe prazos, encontre pendências e mantenha os compromissos da unidade em dia.</p>
        </header>
        {currentUser.role === "ADMIN" && <Link href="/usuarios" className="mb-6 inline-block text-blue-700 dark:text-blue-300 underline">Gerenciar usuários</Link>}
        {!isDemoModeEnabled() && <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-700">{currentUser.name} · {currentUser.role}</p>
          <LogoutButton />
        </div>}
        <Link href="/tarefas" className="mb-4 inline-block text-blue-700 dark:text-blue-300 underline">Lista de tarefas · busca e filtros</Link>
        <ArchiveFilter />
        {archived ? (
          <ArchivedTaskList tasks={tasks} currentUser={currentUser} />
        ) : (
          <>
            <DateFilter />
            <StatusCards tasks={tasks} currentUser={currentUser} employees={allEmployees} />
            <div className={view === "year" ? "grid grid-cols-1 gap-8" : "grid grid-cols-1 gap-8 xl:grid-cols-3"}>
              <div className={view === "month" ? "min-w-0 xl:col-span-2" : "min-w-0"}>
                {view === "month" ? (
                  <DashboardCalendar tasks={tasks} currentDate={referenceDate} currentUser={currentUser} employees={allEmployees} />
                ) : (
                  <YearView key={year} tasks={tasks} year={year} currentUser={currentUser} employees={allEmployees} />
                )}
              </div>
              {canWriteTasks(currentUser) && <div className="min-w-0"><TaskForm employees={allEmployees} /></div>}
            </div>
          </>
        )}
      </div>
      {isDemoModeEnabled() && <UserSwitcher currentUser={currentUser} />}
    </main>
  );
}
