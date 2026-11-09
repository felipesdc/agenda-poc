"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import ThemeSelect from "./ThemeSelect";

export default function AppHeader() {
  const path = usePathname();
  return <header className="border-b border-gray-200 bg-surface">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
      <Link href="/" className="flex items-center gap-3 text-gray-900"><span className="rounded-xl bg-blue-600 p-2 text-white"><CalendarDays className="h-5 w-5" /></span><span className="font-semibold tracking-tight">Agenda da Unidade</span></Link>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <nav aria-label="Navegação principal" className="flex flex-wrap gap-1">{[{ href: "/", label: "Calendário" }, { href: "/meu-dia", label: "Meu dia" }, { href: "/pendencias", label: "Pendências" }, { href: "/tarefas", label: "Lista de tarefas" }].map(({ href, label }) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-medium ${path === href ? "bg-muted text-gray-900" : "text-gray-600 hover:bg-muted"}`}>{label}</Link>)}</nav>
        <ThemeSelect />
      </div>
    </div>
  </header>;
}
