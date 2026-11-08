"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe: false }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente."
          : response.status >= 500 ? "Login indisponível. Tente novamente mais tarde."
          : "E-mail ou senha inválidos.");
        return;
      }
      setPassword("");
      router.replace("/");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Entrar na agenda" aria-busy={pending} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">E-mail</label>
        <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-gray-900" />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Senha</label>
        <input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-gray-900" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Entrando..." : "Entrar"}</button>
      <p className="text-xs text-gray-600">Para obter acesso ou redefinir sua senha, contate o administrador da unidade.</p>
    </form>
  );
}
