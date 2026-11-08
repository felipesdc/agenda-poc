"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createManagedUser, updateManagedUser, setManagedUserActive } from "@/user-actions";
import type { ManagedUser, UserActionState } from "@/lib/user-input";

function UserEditor({ user, actorId }: { user?: ManagedUser; actorId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<UserActionState | null>(null);
  const busy = useRef(false);
  const prefix = user?.id || "new-user";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true;
    setPending(true);
    setResult(null);
    try {
      const response = user ? await updateManagedUser(user.id, data) : await createManagedUser(data);
      setResult(response);
      if (response.success) {
        if (!user) form.reset();
        router.refresh();
      }
    } catch {
      setResult({ success: false, message: "Não foi possível conectar. Tente novamente." });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const fieldClass = "mt-1 w-full rounded-md border border-gray-300 p-2 text-gray-900";
  return <form onSubmit={submit} aria-label={user ? `Editar ${user.name}` : "Cadastrar usuário"} aria-busy={pending} className="space-y-3">
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor={`${prefix}-name`}>Nome</label><input id={`${prefix}-name`} name="name" required minLength={3} maxLength={120} defaultValue={user?.name} className={fieldClass} /></div>
      <div>{user ? <><span>E-mail</span><p className="mt-1 break-all p-2">{user.email}</p></> : <><label htmlFor={`${prefix}-email`}>E-mail</label><input id={`${prefix}-email`} name="email" type="email" required maxLength={254} className={fieldClass} /></>}</div>
      <div><label htmlFor={`${prefix}-role`}>Perfil</label><select id={`${prefix}-role`} name="role" defaultValue={user?.role || "OPERATOR"} className={fieldClass}>
        <option value="OPERATOR" disabled={user?.id === actorId}>Operador</option><option value="VIEWER" disabled={user?.id === actorId}>Visualizador</option><option value="ADMIN">Gestor</option>
      </select></div>
      <div className="flex items-end"><button type="submit" className="rounded-md bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{pending ? "Salvando…" : user ? "Salvar alterações" : "Cadastrar usuário"}</button></div>
    </fieldset>
    {user?.id === actorId && <p className="text-sm text-gray-600">Seu perfil de gestor deve ser mantido.</p>}
    {result && <p role={result.success ? "status" : "alert"} className={result.success ? "text-green-800 dark:text-green-300" : "text-red-700 dark:text-red-300"}>{result.message}</p>}
  </form>;
}

export default function UserManagement({ users, actorId }: { users: ManagedUser[]; actorId: string }) {
  return <>
    <section className="rounded-lg border border-gray-200 bg-surface p-4"><h2 className="mb-4 text-lg font-semibold">Novo usuário</h2><UserEditor actorId={actorId} /></section>
    <section aria-label="Usuários cadastrados" className="space-y-4"><h2 className="text-lg font-semibold">Cadastros ({users.length})</h2>
      {users.map((user) => <article key={`${user.id}-${user.name}-${user.role}`} className="rounded-lg border border-gray-200 bg-surface p-4">
        <h3 className="mb-2 font-semibold">{user.name} · {user.isActive ? "Ativo" : "Desativado"}</h3><p className="mb-4 text-sm text-gray-600">{user.hasPassword ? "Senha cadastrada" : "Aguardando provisionamento de senha"}</p><UserEditor user={user} actorId={actorId} />
        {user.id !== actorId && <ActivationControl key={`${user.id}-${user.isActive}`} user={user} />}
      </article>)}
    </section>
  </>;
}

function ActivationControl({ user }: { user: ManagedUser }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<UserActionState | null>(null);
  const busy = useRef(false);
  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setResult(null);
    try {
      const response = await setManagedUserActive(user.id, !user.isActive);
      setResult(response);
      if (response.success) { setConfirming(false); router.refresh(); }
    } catch { setResult({ success: false, message: "Não foi possível conectar. Tente novamente." }); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="mt-4 border-t border-gray-200 pt-4">
    {confirming ? <>
      <p>{user.isActive ? "Desativar bloqueia o acesso e encerra as sessões. Tarefas e histórico serão preservados." : "Reativar permite um novo login com a senha existente. Sessões antigas permanecem encerradas."}</p>
      <div className="mt-2 flex gap-3"><button type="button" disabled={pending} onClick={confirm} className="rounded border px-3 py-2 disabled:opacity-50">{pending ? "Processando…" : "Confirmar"}</button><button type="button" disabled={pending} onClick={() => { setConfirming(false); setResult(null); }} className="rounded border px-3 py-2">Cancelar</button></div>
    </> : <button type="button" onClick={() => { setConfirming(true); setResult(null); }} className="rounded border px-3 py-2">{user.isActive ? "Desativar conta" : "Reativar conta"}</button>}
    {result && <p role={result.success ? "status" : "alert"} className="mt-2">{result.message}</p>}
  </div>;
}
