import Link from "next/link";
import { getManagedUsers, getUserAudit } from "@/lib/managed-users";
import { getCurrentUser } from "@/lib/auth";
import UserManagement from "@/components/UserManagement";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await getManagedUsers();
  if (!users) return <main id="main-content" className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Acesso restrito</h1><p className="my-4">A gestão de usuários é exclusiva do gestor da unidade.</p><Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link></main>;
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return <main id="main-content" className="p-8">Acesso restrito.</main>;
  const history = await getUserAudit();
  return <main id="main-content" className="mx-auto max-w-5xl space-y-6 p-8 text-gray-900">
    <Link href="/" className="text-blue-700 dark:text-blue-300 underline">Voltar à agenda</Link>
    <h1 className="text-2xl font-bold">Usuários da unidade</h1>
    <p>Cadastre usuários e ajuste seus perfis nesta unidade. O e-mail e a unidade permanecem vinculados ao cadastro original.</p>
    <UserManagement users={users} actorId={actor.id} />
    <section aria-label="Histórico administrativo" className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="text-lg font-semibold">Histórico administrativo</h2>
      <p className="my-2 text-sm text-gray-600">Últimos 100 registros da unidade. Horários de Brasília. Registros anteriores à implantação desta auditoria não estão disponíveis.</p>
      {!history?.length && <p>Nenhuma alteração registrada.</p>}
      <ol className="divide-y divide-gray-200">{history?.map((entry) => <li key={entry.id} className="space-y-1 py-3">
        <p><strong>{entry.action === "CREATE" ? "Cadastro" : entry.action === "DEACTIVATE" ? "Desativação" : entry.action === "REACTIVATE" ? "Reativação" : "Alteração"}</strong> de {entry.userEmail}</p>
        <p className="text-sm text-gray-600">Por {entry.actorName} · <time dateTime={entry.timestamp.toISOString()}>{entry.timestamp.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></p>
        <p>Nome: {entry.nameBefore === null ? entry.nameAfter : `${entry.nameBefore} → ${entry.nameAfter}`}</p>
        <p>Perfil: {entry.roleBefore === null ? entry.roleAfter : `${entry.roleBefore} → ${entry.roleAfter}`}</p>
        {entry.activeAfter !== null && <p>Situação: {entry.activeBefore === null ? "" : `${entry.activeBefore ? "Ativo" : "Desativado"} → `}{entry.activeAfter ? "Ativo" : "Desativado"}</p>}
      </li>)}</ol>
    </section>
    <aside className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-4"><h2 className="font-semibold">Acesso por senha</h2><p className="mt-2">Após cadastrar o usuário, o responsável pelo ambiente deve provisionar a senha pelo terminal com <code>npm run auth:provision -- --email email-do-usuario</code>. O mesmo comando redefine a senha e revoga sessões anteriores. Não há senha padrão.</p></aside>
  </main>;
}
