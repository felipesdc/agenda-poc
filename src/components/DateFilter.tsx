"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Grid,
} from "lucide-react";
import { format, addMonths, subMonths, addYears, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- CORREÇÃO AQUI ---
  // Não usamos mais "||", verificamos se o parâmetro existe.
  const rawMonth = searchParams.get("month");
  const rawYear = searchParams.get("year");

  const now = new Date();

  // Se rawMonth for null (não tem na URL), usa o mês atual.
  // Se for '0', '1', etc, converte para número.
  const month = rawMonth !== null ? Number(rawMonth) : now.getMonth();
  const year = rawYear !== null ? Number(rawYear) : now.getFullYear();
  // ---------------------

  const currentDate = new Date(year, month, 1);

  // A lógica de view continua igual, mas vamos garantir o fallback
  const view = searchParams.get("view") === "year" ? "year" : "month";

  const updateUrl = (newDate: Date, newView: string) => {
    const params = new URLSearchParams();
    params.set("view", newView);
    params.set("month", newDate.getMonth().toString());
    params.set("year", newDate.getFullYear().toString());
    router.push(`/?${params.toString()}`);
  };

  const handlePrev = () => {
    if (view === "month") updateUrl(subMonths(currentDate, 1), view);
    else updateUrl(subYears(currentDate, 1), view);
  };

  const handleNext = () => {
    if (view === "month") updateUrl(addMonths(currentDate, 1), view);
    else updateUrl(addYears(currentDate, 1), view);
  };

  const toggleView = (v: string) => updateUrl(currentDate, v);

  return (
    <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => toggleView("month")}
            className={`p-2 rounded-md text-sm font-medium transition-all ${
              view === "month"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <CalendarIcon className="w-4 h-4 inline mr-2" />
            Mês
          </button>
          <button
            onClick={() => toggleView("year")}
            className={`p-2 rounded-md text-sm font-medium transition-all ${
              view === "year"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Grid className="w-4 h-4 inline mr-2" />
            Ano
          </button>
        </div>

        <h2 className="text-xl font-bold text-gray-800 capitalize min-w-[200px]">
          {view === "month"
            ? format(currentDate, "MMMM yyyy", { locale: ptBR })
            : format(currentDate, "yyyy")}
        </h2>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePrev}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={handleNext}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
