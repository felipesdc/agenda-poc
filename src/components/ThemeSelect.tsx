"use client";

import { useEffect, useSyncExternalStore } from "react";

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
function applyTheme() {
  const selected = preference();
  document.documentElement.dataset.theme = selected === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : selected;
}
export default function ThemeSelect() {
  const selected = useSyncExternalStore(subscribe, preference, () => "system");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme();
    media.addEventListener("change", applyTheme);
    window.addEventListener("storage", applyTheme);
    return () => { media.removeEventListener("change", applyTheme); window.removeEventListener("storage", applyTheme); };
  }, []);
  return <div className="flex items-center gap-2 text-sm">
    <label htmlFor="app-theme" className="text-gray-600">Tema</label>
    <select id="app-theme" value={selected} onChange={(event) => {
      try { localStorage.setItem(KEY, event.target.value); } catch { document.documentElement.dataset.theme = event.target.value === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : event.target.value; return; }
      applyTheme(); window.dispatchEvent(new Event(EVENT));
    }} className="rounded-lg border border-gray-300 bg-surface px-3 py-2 text-gray-900"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select>
  </div>;
}
