// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArchiveFilter from "../src/components/ArchiveFilter";
import ArchivedTaskList from "../src/components/ArchivedTaskList";
import DateFilter from "../src/components/DateFilter";
import DashboardCalendar from "../src/components/DashboardCalendar";
import StatusCards from "../src/components/StatusCards";
import YearView from "../src/components/YearView";
import UserSwitcher from "../src/components/UserSwitcher";
import { employees, operator, taskFixture } from "./helpers/fixtures";

const navigation = vi.hoisted(() => ({ query: "month=0&year=2026", push: vi.fn(), switchUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/actions", () => ({
  switchUser: navigation.switchUser, updateTask: vi.fn(), archiveTask: vi.fn(), restoreTask: vi.fn(), completeTask: vi.fn(), validateTask: vi.fn(),
}));

function expectPushedQuery(expectedUrl: string) {
  const actual = navigation.push.mock.calls.at(-1)?.[0];
  expect(actual).toBeTypeOf("string");
  expect(Object.fromEntries(new URL(actual, "http://localhost").searchParams)).toEqual(Object.fromEntries(new URL(expectedUrl, "http://localhost").searchParams));
}

beforeEach(() => { navigation.query = "month=0&year=2026"; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("navegação do calendário", () => {
  it("mantém janeiro quando o parâmetro month é zero", () => {
    render(<DateFilter />);
    expect(screen.getByRole("heading", { name: "janeiro 2026" })).toBeTruthy();
  });

  it("usa mês e ano atuais na ausência dos parâmetros", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    navigation.query = "";
    render(<DateFilter />);
    expect(screen.getByRole("heading", { name: "novembro 2026" })).toBeTruthy();
  });

  it.each([
    ["month=0&year=2026", 2, "/?view=month&month=11&year=2025"],
    ["month=11&year=2026", 3, "/?view=month&month=0&year=2027"],
    ["view=year&month=0&year=2026", 2, "/?view=year&month=0&year=2025"],
    ["view=year&month=0&year=2026", 3, "/?view=year&month=0&year=2027"],
  ])("gera URL correta ao navegar a partir de %s", async (query, buttonIndex, url) => {
    navigation.query = query;
    render(<DateFilter />);
    const name = query.includes("view=year") ? (buttonIndex === 2 ? "Ano anterior" : "Próximo ano") : (buttonIndex === 2 ? "Mês anterior" : "Próximo mês");
    await userEvent.setup().click(screen.getByRole("button", { name }));
    expectPushedQuery(url);
  });

  it("alterna entre mês e ano preservando o período", async () => {
    render(<DateFilter />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ano" }));
    expectPushedQuery("/?view=year&month=0&year=2026");
    await user.click(screen.getByRole("button", { name: "Mês" }));
    expectPushedQuery("/?view=month&month=0&year=2026");
  });
});

describe("calendário e indicadores", () => {
  it("abre os detalhes da tarefa selecionada no calendário mensal", async () => {
    render(<DashboardCalendar tasks={[taskFixture()]} currentDate={new Date(2026, 10, 1)} currentUser={operator} employees={employees} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Enviar remessa" }));
    expect(screen.getByRole("heading", { name: "Enviar remessa" })).toBeTruthy();
    expect(screen.getByText("Conferir os documentos")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Fechar tarefa" }));
    expect(screen.queryByRole("heading", { name: "Enviar remessa" })).toBeNull();
  });

  it("mostra os doze meses do ano", () => {
    render(<YearView tasks={[taskFixture()]} year={2026} />);
    const months = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(months).toEqual(["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]);
  });

  it("conta apenas pendências em cada faixa de prazo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    const tasks = [
      taskFixture({ id: "late", title: "Atrasada", dueDate: new Date(2026, 10, 4, 12) }),
      taskFixture({ id: "today", title: "Hoje", dueDate: new Date(2026, 10, 5, 12) }),
      taskFixture({ id: "soon", title: "Em quinze dias", dueDate: new Date(2026, 10, 20, 12) }),
      taskFixture({ id: "future", title: "Futura", dueDate: new Date(2026, 10, 21, 12) }),
      taskFixture({ id: "completed", title: "Concluída", status: "COMPLETED" }),
      taskFixture({ id: "validated", title: "Validada", status: "VALIDATED" }),
    ];
    render(<StatusCards tasks={tasks} />);
    for (const [title, count] of [["Vencidas / Críticas", "1"], ["Atenção (Próx 15 dias)", "2"], ["No Prazo", "1"]]) {
      const cardHeader = screen.getByText(title).parentElement!;
      expect(within(cardHeader).getByText(count)).toBeTruthy();
    }
    expect(screen.queryByText("Concluída")).toBeNull();
    expect(screen.queryByText("Validada")).toBeNull();
  });

  it("mostra contadores zerados sem tarefas", () => {
    render(<StatusCards tasks={[]} />);
    expect(screen.getAllByText("0")).toHaveLength(3);
  });
});

describe("seletor de demonstração", () => {
  it("exibe usuário atual e solicita troca de perfil", async () => {
    render(<UserSwitcher currentUser={operator} />);
    expect(screen.getByText("Bob Operador")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Alice (Admin)" }));
    expect(navigation.switchUser).toHaveBeenCalledWith("admin@banco.com");
    await user.click(screen.getByRole("button", { name: "Bob (Operador)" }));
    expect(navigation.switchUser).toHaveBeenCalledWith("operador@banco.com");
    await user.click(screen.getByRole("button", { name: "Carlos (Visualizador)" }));
    expect(navigation.switchUser).toHaveBeenCalledWith("leitor@banco.com");
  });
});


describe("consulta das tarefas arquivadas", () => {
  it("alternar para arquivadas preserva o período e a visão da agenda", async () => {
    navigation.query = "view=year&month=0&year=2026";
    render(<ArchiveFilter />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Arquivadas" }));
    expect(navigation.push).toHaveBeenCalledWith("/?view=year&month=0&year=2026&archived=true");
  });

  it("voltar para ativas remove apenas o filtro de arquivamento", async () => {
    navigation.query = "view=year&month=0&year=2026&archived=true";
    render(<ArchiveFilter />);
    expect(screen.getByRole("button", { name: "Arquivadas" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.setup().click(screen.getByRole("button", { name: "Ativas" }));
    expectPushedQuery("/?view=year&month=0&year=2026");
  });

  it("mostra estado vazio do arquivo", () => {
    render(<ArchivedTaskList tasks={[]} currentUser={operator} />);
    expect(screen.getByText("Nenhuma tarefa arquivada nesta unidade.")).toBeTruthy();
  });

  it("abre os detalhes e o histórico de uma tarefa arquivada", async () => {
    const archived = taskFixture({ archivedAt: new Date("2026-11-06T12:00:00Z"), archivedById: "admin", archiveReason: "Processo suspenso" });
    render(<ArchivedTaskList tasks={[archived]} currentUser={operator} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ver detalhes de Enviar remessa" }));
    expect(screen.getByText("Tarefa arquivada")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Histórico" }));
    expect(screen.getByText("Tarefa Criada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Restaurar tarefa" })).toBeNull();
  });
});


describe("robustez dos filtros e cores anuais", () => {
  it("mês/ano inválidos usam o período atual", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 12));
    navigation.query = "month=NaN&year=999999";
    render(<DateFilter />);
    expect(screen.getByRole("heading", { name: "novembro 2026" })).toBeTruthy();
  });
  it.each([
    ["month=0&year=1900", "Mês anterior"], ["view=year&year=1900", "Ano anterior"],
    ["month=11&year=2100", "Próximo mês"], ["view=year&year=2100", "Próximo ano"],
  ])("impede navegação além do intervalo (%s)", async (query, name) => {
    navigation.query = query;
    render(<DateFilter />);
    expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
    await userEvent.setup().click(screen.getByRole("button", { name }));
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it("navegar preserva filtros adicionais", async () => {
    navigation.query = "month=0&year=2026&filter=mine";
    render(<DateFilter />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Próximo mês" }));
    expectPushedQuery("/?view=month&month=1&year=2026&filter=mine");
  });
  it("visão anual representa concluídas em azul e validadas em cinza com texto acessível", () => {
    const tasks = [taskFixture({ status: "COMPLETED", dueDate: new Date(2026, 10, 5, 12) }), taskFixture({ id: "validated", status: "VALIDATED", dueDate: new Date(2026, 10, 6, 12) })];
    render(<YearView tasks={tasks} year={2026} />);
    expect(screen.getByRole("img", { name: "05/11/2026: Concluída" }).className).toContain("bg-blue-500");
    expect(screen.getByRole("img", { name: "06/11/2026: Validada" }).className).toContain("bg-gray-400");
  });
});
