"use client";

import { useRef, useState } from "react";
import { User } from "lucide-react";
import type { User as AgendaUser } from "@prisma/client";
import { switchUser } from "@/actions";

export default function UserSwitcher({ currentUser }: { currentUser: AgendaUser | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function change(email: string) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await switchUser(email);
      if (result && !result.success) setError(result.message);
    } catch { setError("Não foi possível trocar o perfil. Tente novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return (
    <div aria-label="Perfis de demonstração" aria-busy={pending} className="mx-4 my-6 sm:fixed sm:bottom-4 sm:right-4 sm:m-0 bg-surface border border-gray-200 shadow-xl rounded-lg p-3 z-50 flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2 border-b pb-2 mb-1">
        <User className="w-4 h-4 text-gray-500" />
        <div>
          <p className="font-bold text-gray-800">
            {currentUser ? currentUser.name : "Deslogado"}
          </p>
          <p className="text-gray-500 uppercase font-mono text-[10px]">
            {currentUser ? currentUser.role : "-"}
          </p>
        </div>
      </div>

      <p className="text-gray-400 font-semibold mb-1">Trocar Perfil:</p>

      <button
        disabled={pending} onClick={() => change("operador@banco.com")}
        className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-3 py-2 rounded text-left transition-colors font-medium"
      >
        Bob (Operador)
      </button>

      <button
        disabled={pending} onClick={() => change("admin@banco.com")}
        className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 px-3 py-2 rounded text-left transition-colors font-medium"
      >
        Alice (Admin)
      </button>
      <button
        disabled={pending} onClick={() => change("leitor@banco.com")}
        className="bg-gray-50 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded text-left transition-colors font-medium"
      >
        Carlos (Visualizador)
      </button>
      {pending && <p role="status">Trocando perfil…</p>}
      {error && <p role="alert" className="max-w-64 text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
