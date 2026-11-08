// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ExportTasksButton from "../src/components/ExportTasksButton";
beforeEach(() => { vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("baixa o CSV dos filtros e libera a URL temporária", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["CSV"]) }); vi.stubGlobal("fetch", fetchMock);
  const click = vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(() => {});
  render(<ExportTasksButton href="/api/tarefas/exportar?q=relatorio" />);
  await userEvent.setup().click(screen.getByRole("button",{name:"Exportar CSV"}));
  expect(fetchMock).toHaveBeenCalledWith("/api/tarefas/exportar?q=relatorio",expect.objectContaining({credentials:"same-origin"}));
  expect(click).toHaveBeenCalledOnce(); await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test"), { timeout: 2000 });
});
it("mostra erro do limite e permite repetir sem navegar para JSON", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({message:"Refine os filtros."})}));
  render(<ExportTasksButton href="/api/tarefas/exportar" />);
  await userEvent.setup().click(screen.getByRole("button",{name:"Exportar CSV"}));
  expect(screen.getByRole("alert").textContent).toBe("Refine os filtros.");
  expect((screen.getByRole("button",{name:"Exportar CSV"}) as HTMLButtonElement).disabled).toBe(false);
});
