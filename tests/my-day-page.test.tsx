// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MyDayPage from "../src/app/meu-dia/page";
import { operator, taskFixture } from "./helpers/fixtures";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../src/lib/my-day", () => ({ getMyDayData: mocks.load }));
vi.mock("../src/components/TaskList", () => ({ default: ({ label }: { label: string }) => <div>Lista: {label}</div> }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue({ currentUser: operator, employees: [], focalOptions: [{ id: 1001, name: "Alice" }], groups: [{ id: "today", title: "Hoje", total: 26, tasks: [taskFixture()], href: "/tarefas?status=PENDING" }, { id: "next", title: "Próximos sete dias", total: 0, tasks: [], href: "/tarefas" }] }); });
it("mostra grupos, contadores, limite e filtro acessível", async () => {
  render(await MyDayPage({ searchParams: Promise.resolve({ focalPoint: "1001" }) }));
  expect(mocks.load).toHaveBeenCalledWith(1001);
  expect(screen.getByLabelText("Ponto focal")).toHaveProperty("value", "1001");
  expect(screen.getByRole("region", { name: "Hoje (26)" })).toBeTruthy();
  expect(screen.getByText("Mostrando as primeiras 1 de 26 pendências.")).toBeTruthy();
  expect(screen.getByText("Nenhuma pendência neste grupo.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver hoje na lista" }).getAttribute("href")).toContain("status=PENDING");
});
it("recusa filtro inválido sem consultar dados", async () => {
  render(await MyDayPage({ searchParams: Promise.resolve({ focalPoint: ["1", "2"] }) }));
  expect(screen.getByRole("alert")).toBeTruthy(); expect(mocks.load).not.toHaveBeenCalled();
});
it("orienta identificação sem sessão", async () => {
  mocks.load.mockResolvedValue({ currentUser: null });
  render(await MyDayPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/Identifique-se/)).toBeTruthy();
});
