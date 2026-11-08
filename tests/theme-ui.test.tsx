// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeSelect from "../src/components/ThemeSelect";
let systemDark = false;
let mediaChange: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear(); delete document.documentElement.dataset.theme; systemDark = false;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return systemDark; }, addEventListener: (_type: string, callback: () => void) => { mediaChange = callback; }, removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("preferência de tema", () => {
  it("segue o sistema sem preferência salva", () => {
    systemDark = true; render(<ThemeSelect />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect((screen.getByLabelText("Tema") as HTMLSelectElement).value).toBe("system");
  });
  it("salva a escolha e respeita preferência explícita ao mudar o sistema", async () => {
    const user = userEvent.setup(); render(<ThemeSelect />);
    await user.selectOptions(screen.getByLabelText("Tema"), "dark");
    expect(localStorage.getItem("agenda-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    systemDark = false; mediaChange?.();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.selectOptions(screen.getByLabelText("Tema"), "light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
  it("restaura escolha salva e volta a acompanhar o sistema", async () => {
    localStorage.setItem("agenda-theme", "dark");
    const user = userEvent.setup(); render(<ThemeSelect />);
    expect((screen.getByLabelText("Tema") as HTMLSelectElement).value).toBe("dark");
    await user.selectOptions(screen.getByLabelText("Tema"), "system");
    expect(document.documentElement.dataset.theme).toBe("light");
    systemDark = true; mediaChange?.();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

it("mantém seleção temporária quando o armazenamento está bloqueado", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  const user = userEvent.setup(); render(<ThemeSelect />);
  await user.selectOptions(screen.getByLabelText("Tema"), "dark");
  expect((screen.getByLabelText("Tema") as HTMLSelectElement).value).toBe("dark");
  systemDark = false; mediaChange?.();
  expect(document.documentElement.dataset.theme).toBe("dark");
});
