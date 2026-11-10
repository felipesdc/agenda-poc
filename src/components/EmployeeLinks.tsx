"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeLink } from "@/actions/employee-link";

type LinkUser = { id: string; name: string; employeeId: number | null };
export default function EmployeeLinks({ users, employees }: { users: LinkUser[]; employees: { id: number; name: string }[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const router = useRouter();
  return <section className="space-y-3 rounded-lg border bg-surface p-4"><h2 className="text-lg font-semibold">Vínculo com ponto focal</h2>
    <p className="text-sm text-gray-600">Cada ponto focal pode estar associado a uma conta. Estão disponíveis pontos focais de tarefas desta unidade.</p>
    {users.map((user) => <form key={`${user.id}-${user.employeeId}`} className="flex flex-wrap items-end gap-3" onSubmit={async (event) => {
      event.preventDefault(); if (pending) return;
      const value = new FormData(event.currentTarget).get("employeeId"); setPending(user.id); setMessage(null);
      try { const result = await setEmployeeLink(user.id, value ? Number(value) : null); setMessage({ text: result.message, ok: result.success }); if (result.success) router.refresh(); }
      catch { setMessage({ text: "Não foi possível atualizar o vínculo.", ok: false }); } finally { setPending(null); }
    }}><div className="min-w-48 flex-1"><label htmlFor={`employee-${user.id}`} className="block text-sm">{user.name}</label><select id={`employee-${user.id}`} name="employeeId" defaultValue={user.employeeId ?? ""} className="mt-1 w-full rounded border p-2"><option value="">Sem vínculo</option>{user.employeeId && !employees.some((item) => item.id === user.employeeId) && <option value={user.employeeId}>Vínculo atual · {user.employeeId}</option>}{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.id}</option>)}</select></div><button disabled={Boolean(pending)} className="min-h-11 rounded border px-4">{pending === user.id ? "Salvando…" : `Salvar vínculo de ${user.name}`}</button></form>)}
    {message && <p role={message.ok ? "status" : "alert"}>{message.text}</p>}
  </section>;
}
