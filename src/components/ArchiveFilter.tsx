"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ArchiveFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const archived = searchParams.get("archived") === "true";
  const change = (showArchived: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (showArchived) params.set("archived", "true");
    else params.delete("archived");
    router.push(params.size ? `/?${params.toString()}` : "/");
  };
  return (
    <nav aria-label="Situação das tarefas" className="flex gap-2 mb-6">
      {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={archived === value} onClick={() => change(value)} className={`px-4 py-2 rounded-lg border text-sm font-medium ${archived === value ? "bg-blue-600 border-blue-600 text-white" : "bg-surface text-gray-700"}`}>{value ? "Arquivadas" : "Ativas"}</button>)}
    </nav>
  );
}
