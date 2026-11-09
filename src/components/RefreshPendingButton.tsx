"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RefreshPendingButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="min-h-11 rounded-lg border bg-surface px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? "Atualizando..." : "Atualizar pendências"}</button>;
}
