"use client";

import { User } from "lucide-react";
import { switchUser } from "@/actions";

export default function UserSwitcher({ currentUser }: { currentUser: any }) {
  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 shadow-xl rounded-lg p-3 z-50 flex flex-col gap-2 text-xs">
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
        onClick={() => switchUser("operador@banco.com")}
        className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded text-left transition-colors font-medium"
      >
        Bob (Operador)
      </button>

      <button
        onClick={() => switchUser("admin@banco.com")}
        className="bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-2 rounded text-left transition-colors font-medium"
      >
        Alice (Admin)
      </button>
    </div>
  );
}
