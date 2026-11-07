import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskStatusColor, getDayStatusColor } from "../src/lib/utils";

describe("classificação por prazo e estado", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 5, 12));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [4, "red"], [5, "yellow"], [20, "yellow"], [21, "green"],
  ])("classifica pendência com vencimento em %i/11", (day, color) => {
    expect(getTaskStatusColor(new Date(2026, 10, day, 23, 59), "PENDING")).toBe(color);
  });

  it("considera hoje mesmo quando o horário do prazo já passou", () => {
    expect(getTaskStatusColor(new Date(2026, 10, 5, 0, 1), "PENDING")).toBe("yellow");
  });

  it.each(["COMPLETED", "VALIDATED"])("prioriza o estado %s sobre o prazo", (status) => {
    for (const day of [1, 5, 25]) {
      expect(getTaskStatusColor(new Date(2026, 10, day), status)).toBe(status === "COMPLETED" ? "blue" : "gray");
    }
  });

  it("não modifica a data recebida", () => {
    const date = new Date(2026, 10, 4, 18, 35);
    const timestamp = date.getTime();
    getTaskStatusColor(date, "PENDING");
    expect(date.getTime()).toBe(timestamp);
  });

  it("compara dias locais na passagem de ano", () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23));
    expect(getTaskStatusColor(new Date(2027, 0, 1, 0), "PENDING")).toBe("yellow");
  });
  it("dia sem tarefas não recebe cor", () => {
    expect(getDayStatusColor([])).toBeNull();
  });

  it("prioriza pendências sobre concluídas e validadas no mesmo dia", () => {
    for (const [day, color] of [[4, "red"], [5, "yellow"], [30, "green"]] as const) {
      const tasks = [
        { dueDate: new Date(2026, 10, day), status: "PENDING" },
        { dueDate: new Date(2026, 10, day), status: "COMPLETED" },
        { dueDate: new Date(2026, 10, day), status: "VALIDATED" },
      ];
      expect(getDayStatusColor(tasks)).toBe(color);
      expect(getDayStatusColor(tasks.slice(1))).toBe("blue");
      expect(getDayStatusColor(tasks.slice(2))).toBe("gray");
    }
  });

});
