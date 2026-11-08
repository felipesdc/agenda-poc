"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Grid,
} from "lucide-react";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import { resolveCalendarParams, MIN_CALENDAR_YEAR, MAX_CALENDAR_YEAR } from "@/lib/calendar-params";
import { ptBR } from "date-fns/locale";

export default function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { month, year, view } = resolveCalendarParams({
    month: searchParams.getAll("month"), year: searchParams.getAll("year"), view: searchParams.getAll("view"),
  });
  const currentDate = new Date(year, month, 1);
  const atStart = year === MIN_CALENDAR_YEAR && (view === "year" || month === 0);
  const atEnd = year === MAX_CALENDAR_YEAR && (view === "year" || month === 11);

  const updateUrl = (newDate: Date, newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    params.set("month", newDate.getMonth().toString());
    params.set("year", newDate.getFullYear().toString());
    router.push(`/?${params.toString()}`);
  };

  const handlePrev = () => {
    if (atStart) return;
    if (view === "month") updateUrl(subMonths(currentDate, 1), view);
    else updateUrl(subYears(currentDate, 1), view);
  };

  const handleNext = () => {
    if (atEnd) return;
    if (view === "month") updateUrl(addMonths(currentDate, 1), view);
    else updateUrl(addYears(currentDate, 1), view);
  };

  const toggleView = (v: string) => updateUrl(currentDate, v);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border shadow-sm mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            aria-pressed={view === "month"}
            onClick={() => toggleView("month")}
            className={`p-2 rounded-md text-sm font-medium transition-all ${
              view === "month"
                ? "bg-surface shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <CalendarIcon className="w-4 h-4 inline mr-2" />
            Mês
          </button>
          <button
            aria-pressed={view === "year"}
            onClick={() => toggleView("year")}
            className={`p-2 rounded-md text-sm font-medium transition-all ${
              view === "year"
                ? "bg-surface shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Grid className="w-4 h-4 inline mr-2" />
            Ano
          </button>
        </div>

        <h2 aria-live="polite" aria-atomic="true" className="text-xl font-bold text-gray-800 capitalize">
          {view === "month"
            ? format(currentDate, "MMMM yyyy", { locale: ptBR })
            : format(currentDate, "yyyy")}
        </h2>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => updateUrl(new Date(), view)} className="min-h-11 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100">Hoje</button>
        <button
          aria-label={view === "month" ? "Mês anterior" : "Ano anterior"}
          disabled={atStart}
          onClick={handlePrev}
          className="min-h-11 min-w-11 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          aria-label={view === "month" ? "Próximo mês" : "Próximo ano"}
          disabled={atEnd}
          onClick={handleNext}
          className="min-h-11 min-w-11 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
