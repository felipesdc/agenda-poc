import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { isPasswordAuthConfigured } from "@/lib/password-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Entrar na agenda</h1>
        <p className="mb-6 text-sm text-gray-600">Use o acesso fornecido pelo administrador.</p>
        {isPasswordAuthConfigured() ? <LoginForm /> : <p role="alert" className="text-sm text-gray-700">Login por senha ainda não configurado. Contate o administrador.</p>}
        <Link href="/" className="mt-4 inline-block text-sm text-blue-700 hover:underline">Voltar para a agenda</Link>
      </section>
    </main>
  );
}
