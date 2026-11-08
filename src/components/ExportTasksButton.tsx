"use client";

import { useRef, useState } from "react";

export default function ExportTasksButton({ href }: { href: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  async function download() {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.message || "Não foi possível exportar. Tente novamente."); return;
      }
      const url = URL.createObjectURL(await response.blob());
      try {
        const anchor = document.createElement("a"); anchor.href = url;
        anchor.download = "tarefas.csv"; document.body.append(anchor); anchor.click(); anchor.remove();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { setMessage("Falha de conexão ao exportar. Tente novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="space-y-2">
    <button type="button" onClick={download} disabled={pending} aria-busy={pending} className="min-h-11 rounded-lg border border-gray-300 bg-surface px-4 py-2 text-sm font-medium text-gray-900 hover:bg-muted disabled:opacity-60">{pending ? "Preparando CSV…" : "Exportar CSV"}</button>
    <p className="text-xs text-gray-600">Exporta todos os resultados dos filtros aplicados, até 5.000 tarefas.</p>
    {message && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p>}
  </div>;
}
