"use client";

import { useEffect, useSyncExternalStore, useState } from "react";

const KEY = "agenda-theme";
const EVENT = "agenda-theme-change";
function preference() {
  try { const value = localStorage.getItem(KEY); return value === "light" || value === "dark" ? value : "system"; }
  catch { return "system"; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}
function applyTheme(selected: string) {
  document.documentElement.dataset.theme = selected === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : selected;
}
export default function ThemeSelect() {
  const saved = useSyncExternalStore(subscribe, preference, () => "system");
  const [temporary, setTemporary] = useState<string | null>(null);
  const selected = temporary ?? saved;
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(selected);
    update();
    media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); };
  }, [selected]);
  return <div className="flex items-center gap-2 text-sm">
    <label htmlFor="app-theme" className="text-gray-600">Tema</label>
    <select id="app-theme" value={selected} onChange={(event) => {
      const value = event.target.value;
      try { localStorage.setItem(KEY, value); setTemporary(null); }
      catch { setTemporary(value); }
      applyTheme(value); window.dispatchEvent(new Event(EVENT));
    }} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-gray-900"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select>
  </div>;
}
