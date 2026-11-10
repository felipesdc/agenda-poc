// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SummaryPage from "../src/app/resumo/page";
import { admin } from "./helpers/fixtures";
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { task: { count: mocks.count } } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("mostra indicadores da unidade e links com período e estado", async () => {
  mocks.getCurrentUser.mockResolvedValue(admin); mocks.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
  render(await SummaryPage({ searchParams: Promise.resolve({ month: "0", year: "2026" }) }));
  expect(screen.getByText("Prazos de 01/01/2026 a 31/01/2026")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Aguardando validação/ }).getAttribute("href")).toContain("status=COMPLETED");
  expect(mocks.count.mock.calls[0][0].where).toMatchObject({ unitId: admin.unitId, archivedAt: null });
});
it("exige sessão", async () => { mocks.getCurrentUser.mockResolvedValue(null); render(await SummaryPage({ searchParams: Promise.resolve({}) })); expect(screen.getByText(/Identifique-se/)).toBeTruthy(); expect(mocks.count).not.toHaveBeenCalled(); });
