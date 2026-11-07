"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("logout");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Não foi possível encerrar a sessão. Tente novamente.");
    } finally { inFlight.current = false; setPending(false); }
  }
  return <div>
    <button type="button" onClick={logout} disabled={pending} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50">{pending ? "Saindo..." : "Sair"}</button>
    {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
  </div>;
}
