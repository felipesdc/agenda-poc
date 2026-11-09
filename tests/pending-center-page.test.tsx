// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PendingCenterPage from "../src/app/pendencias/page";
import { pendingCenterUrl, resolvePendingParams } from "../src/lib/pending-center";
import { admin, operator, taskFixture } from "./helpers/fixtures";
const mocks = vi.hoisted(() => ({ load: vi.fn(), refresh: vi.fn() }));
vi.mock("../src/lib/pending-center", async (original) => ({ ...await original<typeof import("../src/lib/pending-center")>(), getPendingCenterData: mocks.load }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../src/components/TaskList", () => ({ default: ({ label }: { label: string }) => <div>Lista: {label}</div> }));
const data = { restricted: false, currentUser: admin, tasks: [taskFixture()], employees: [], counts: [{ id: "all", label: "Todas as pendências", count: 26 }, { id: "today", label: "Prazo hoje", count: 26 }, { id: "validation", label: "Aguardando validação", count: 0 }], total: 26, pages: 2, page: 1, updatedAt: new Date("2026-12-31T12:00:00Z") };
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(data); });
afterEach(cleanup);
it("aplica categoria, mostra contadores e preserva paginação", async () => {
  render(await PendingCenterPage({ searchParams: Promise.resolve({ category: "today" }) }));
  expect(mocks.load).toHaveBeenCalledWith("today", 1);
  expect(screen.getByRole("link", { name: "Prazo hoje 26" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Próxima página" }).getAttribute("href")).toBe("/pendencias?category=today&page=2");
  expect(screen.getByRole("link", { name: /Abrir fila/ })).toBeTruthy();
});
it("explica categoria vazia e oculta atalho de validação para operador", async () => {
  mocks.load.mockResolvedValue({ ...data, currentUser: operator, total: 0, tasks: [], counts: [], pages: 1 });
  render(await PendingCenterPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Nenhuma pendência nesta categoria.")).toBeTruthy(); expect(screen.queryByRole("link", { name: /Abrir fila/ })).toBeNull();
});
it("mostra orientações quando a consulta é restrita", async () => {
  mocks.load.mockResolvedValue({ restricted: true });
  render(await PendingCenterPage({ searchParams: Promise.resolve({ category: "validation" }) }));
  expect(screen.getByText(/exclusiva do gestor/)).toBeTruthy(); expect(screen.getByRole("link", { name: "Ver pendências de prazo" })).toBeTruthy();
});
it("orienta identificação sem sessão", async () => {
  mocks.load.mockResolvedValue(null); render(await PendingCenterPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/Identifique-se/)).toBeTruthy();
});
it("normaliza parâmetros inválidos e constrói URLs locais", () => {
  expect(resolvePendingParams({ category: ["validation", "all"], page: "-2" })).toEqual({ category: "all", page: 1 });
  expect(resolvePendingParams({ category: "today", page: "2.5" })).toEqual({ category: "today", page: 1 });
  expect(pendingCenterUrl("all")).toBe("/pendencias"); expect(pendingCenterUrl("validation", 2)).toBe("/pendencias?category=validation&page=2");
});
it("atualiza dados ao acionar o botão", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  render(await PendingCenterPage({ searchParams: Promise.resolve({}) }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Atualizar pendências" })); expect(mocks.refresh).toHaveBeenCalledOnce();
});
