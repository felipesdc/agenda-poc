// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormState } from "../src/actions";
import TaskForm from "../src/components/TaskForm";
import TaskModal from "../src/components/TaskModal";
import { admin, employees, operator, taskFixture } from "./helpers/fixtures";

const actions = vi.hoisted(() => ({
  createTask: vi.fn<(previous: FormState, data: FormData) => Promise<FormState>>(),
  updateTask: vi.fn<(id: string, previous: FormState, data: FormData) => Promise<FormState>>(),
  archiveTask: vi.fn<(id: string, reason: string) => Promise<FormState>>(),
  restoreTask: vi.fn<(id: string) => Promise<FormState>>(),
  completeTask: vi.fn<(id: string) => Promise<FormState>>(),
  validateTask: vi.fn<(id: string) => Promise<FormState>>(),
}));
vi.mock("@/actions", () => actions);

beforeEach(() => {
  vi.resetAllMocks();
  for (const action of Object.values(actions)) action.mockResolvedValue({ success: true, message: "Operação realizada" });
});
afterEach(cleanup);

async function fillCreateForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Título"), "Enviar documentos");
  fireEvent.change(screen.getByLabelText("Prazo final"), { target: { value: "2026-11-10" } });
  await user.selectOptions(screen.getByLabelText("Periodicidade"), "MONTHLY");
  await user.click(screen.getByRole("checkbox", { name: "Bob Operador" }));
  await user.type(screen.getByLabelText("Detalhes"), "Documentos revisados");
  return user;
}

function openModal(overrides: Parameters<typeof taskFixture>[0] = {}, currentUser = operator) {
  const onClose = vi.fn();
  render(<TaskModal task={taskFixture(overrides)} isOpen onClose={onClose} currentUser={currentUser} employees={employees} />);
  return { onClose, user: userEvent.setup() };
}

describe("formulário de cadastro", () => {
  it("envia todos os campos e limpa o formulário após sucesso", async () => {
    render(<TaskForm employees={employees} />);
    const user = await fillCreateForm();
    await user.click(screen.getByRole("button", { name: "Adicionar Compromisso" }));
    await screen.findByRole("status");
    const data = actions.createTask.mock.calls[0][1];
    expect(Object.fromEntries(data)).toMatchObject({ title: "Enviar documentos", dueDate: "2026-11-10", frequency: "MONTHLY", description: "Documentos revisados" });
    expect(data.getAll("focalPoints")).toEqual(["1002"]);
    expect(screen.getByLabelText("Título")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Periodicidade")).toHaveProperty("value", "NONE");
    expect(screen.getByRole("checkbox", { name: "Bob Operador" })).toHaveProperty("checked", false);
  });

  it("exibe falha e erros de campo sem perder os dados digitados", async () => {
    actions.createTask.mockResolvedValue({ success: false, message: "Revise os dados", errors: { title: ["Título inválido"] } });
    render(<TaskForm employees={employees} />);
    const user = await fillCreateForm();
    await user.click(screen.getByRole("button", { name: "Adicionar Compromisso" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Revise os dados");
    expect(screen.getByText("Título inválido")).toBeTruthy();
    expect(screen.getByLabelText("Título")).toHaveProperty("value", "Enviar documentos");
    expect(screen.getByLabelText("Título").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Prazo final")).toHaveProperty("value", "2026-11-10");
    expect(screen.getByLabelText("Periodicidade")).toHaveProperty("value", "MONTHLY");
    expect(screen.getByLabelText("Detalhes")).toHaveProperty("value", "Documentos revisados");
    expect(screen.getByRole("checkbox", { name: "Bob Operador" })).toHaveProperty("checked", true);
  });

  it("recupera erro de transporte e permite tentar novamente", async () => {
    actions.createTask.mockRejectedValueOnce(new Error("offline"));
    render(<TaskForm employees={employees} />);
    const user = await fillCreateForm();
    await user.click(screen.getByRole("button", { name: "Adicionar Compromisso" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Tente novamente");
    await user.click(screen.getByRole("button", { name: "Adicionar Compromisso" }));
    await screen.findByRole("status");
    expect(actions.createTask).toHaveBeenCalledTimes(2);
  });

  it("bloqueia envio enquanto aguarda o servidor", async () => {
    let finish!: (state: FormState) => void;
    actions.createTask.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<TaskForm employees={employees} />);
    const user = await fillCreateForm();
    await user.click(screen.getByRole("button", { name: "Adicionar Compromisso" }));
    expect(screen.getByRole("button", { name: "Salvando..." })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Título").closest("fieldset")).toHaveProperty("disabled", true);
    await act(async () => finish({ success: true, message: "Salvo" }));
    await screen.findByRole("status");
    expect(actions.createTask).toHaveBeenCalledTimes(1);
  });

  it("permite cadastrar sem funcionários disponíveis", () => {
    render(<TaskForm employees={[]} />);
    expect(screen.getByText("Nenhum funcionário cadastrado.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("detalhes, edição e histórico", () => {
  it("não renderiza modal fechado", () => {
    const { container } = render(<TaskModal task={taskFixture()} isOpen={false} onClose={vi.fn()} currentUser={operator} employees={employees} />);
    expect(container.innerHTML).toBe("");
  });

  it("exibe detalhes e histórico com autor", async () => {
    const { user } = openModal();
    expect(screen.getByRole("heading", { name: "Enviar remessa" })).toBeTruthy();
    expect(screen.getByText("Conferir os documentos")).toBeTruthy();
    expect(screen.getByText("Alice Gestora")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Histórico" }));
    expect(screen.getByText("Tarefa Criada")).toBeTruthy();
    expect(screen.getByText("Por: Bob Operador")).toBeTruthy();
  });

  it("edita campos e fecha apenas depois de salvar com sucesso", async () => {
    const { user, onClose } = openModal();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Título")).toHaveProperty("value", "Enviar remessa");
    expect(screen.getByRole("checkbox", { name: "Alice Gestora" })).toHaveProperty("checked", true);
    expect(screen.queryByRole("button", { name: "Confirmar Conclusão" })).toBeNull();
    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Remessa revisada");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.updateTask.mock.calls[0][0]).toBe("task");
    expect(actions.updateTask.mock.calls[0][2].get("title")).toBe("Remessa revisada");
    expect(actions.completeTask).not.toHaveBeenCalled();
  });

  it("preserva edição em caso de erro e permite cancelar sem salvar", async () => {
    actions.updateTask.mockResolvedValue({ success: false, message: "Não foi possível atualizar" });
    const { user, onClose } = openModal();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.type(screen.getByLabelText("Título"), " revisada");
    await user.selectOptions(screen.getByLabelText("Periodicidade"), "ANNUAL");
    await user.click(screen.getByRole("checkbox", { name: "Bob Operador" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByRole("alert");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveProperty("value", "Enviar remessa revisada");
    expect(screen.getByLabelText("Periodicidade")).toHaveProperty("value", "ANNUAL");
    expect(screen.getByRole("checkbox", { name: "Bob Operador" })).toHaveProperty("checked", true);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Título")).toBeNull();
    expect(actions.updateTask).toHaveBeenCalledTimes(1);
  });
});

describe("ações do modal", () => {
  it.each(["complete", "archive", "validate"] as const)("falha de %s mantém modal aberto e libera nova tentativa", async (action) => {
    const actionMock = { complete: actions.completeTask, archive: actions.archiveTask, validate: actions.validateTask }[action];
    actionMock.mockResolvedValueOnce({ success: false, message: "Falha de negócio" });
    const { user, onClose } = openModal(action === "validate" ? { status: "COMPLETED" } : {}, admin);
    const buttonName = { complete: "Confirmar Conclusão", archive: "Arquivar tarefa", validate: "Validar e Finalizar" }[action];
    await user.click(screen.getByRole("button", { name: buttonName }));
    if (action === "archive") {
      await user.type(screen.getByLabelText("Motivo do arquivamento"), "Rotina encerrada");
      await user.click(screen.getByRole("button", { name: "Confirmar arquivamento" }));
    }
    expect((await screen.findByRole("alert")).textContent).toBe("Falha de negócio");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: buttonName })).toHaveProperty("disabled", false);
    await user.click(screen.getByRole("button", { name: action === "archive" ? "Confirmar arquivamento" : buttonName }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actionMock).toHaveBeenCalledTimes(2);
    if (action === "archive") expect(actionMock).toHaveBeenCalledWith("task", "Rotina encerrada");
    else expect(actionMock).toHaveBeenCalledWith("task");
    expect(actions.updateTask).not.toHaveBeenCalled();
  });

  it("cancelar arquivamento preserva tarefa e mantém modal aberto", async () => {
    const { user, onClose } = openModal({}, admin);
    await user.click(screen.getByRole("button", { name: "Arquivar tarefa" }));
    await user.type(screen.getByLabelText("Motivo do arquivamento"), "Rotina encerrada");
    await user.click(screen.getByRole("button", { name: "Cancelar arquivamento" }));
    expect(screen.queryByRole("form", { name: "Arquivar tarefa" })).toBeNull();
    expect(actions.archiveTask).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("trata exceção de rede sem fechar o modal", async () => {
    actions.completeTask.mockRejectedValue(new Error("offline"));
    const { user, onClose } = openModal();
    await user.click(screen.getByRole("button", { name: "Confirmar Conclusão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Tente novamente");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("bloqueia ações concorrentes enquanto conclui", async () => {
    let finish!: (state: FormState) => void;
    actions.completeTask.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, onClose } = openModal({}, admin);
    await user.click(screen.getByRole("button", { name: "Confirmar Conclusão" }));
    for (const name of ["Confirmar Conclusão", "Editar", "Arquivar tarefa", "Fechar tarefa"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
    }
    await user.click(screen.getByRole("button", { name: "Confirmar Conclusão" }));
    expect(actions.completeTask).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true, message: "Concluída" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("operador vê espera por validação e gestor recebe botão de validar", () => {
    const props = { task: taskFixture({ status: "COMPLETED" }), isOpen: true, onClose: vi.fn(), employees };
    const { rerender } = render(<TaskModal {...props} currentUser={operator} />);
    expect(screen.getByText("Aguardando validação da gerência.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Validar e Finalizar" })).toBeNull();
    rerender(<TaskModal {...props} currentUser={admin} />);
    expect(screen.getByRole("button", { name: "Validar e Finalizar" })).toBeTruthy();
  });
});


describe("permissões na interface", () => {
  it.each([
    { ...operator, role: "VIEWER" as const },
    { ...admin, unitId: "another-unit" },
  ])("não oferece mutações fora do escopo do usuário $role/$unitId", (currentUser) => {
    openModal({}, currentUser);
    for (const name of ["Editar", "Arquivar tarefa", "Confirmar Conclusão", "Validar e Finalizar"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("operador pode concluir e editar, mas não arquivar", () => {
    openModal();
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar Conclusão" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Arquivar tarefa" })).toBeNull();
  });

  it.each(["COMPLETED", "VALIDATED"] as const)("não oferece edição ou conclusão de tarefa %s", (status) => {
    openModal({ status }, admin);
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar Conclusão" })).toBeNull();
    expect(screen.getByRole("button", { name: "Arquivar tarefa" })).toBeTruthy();
  });
});

describe("interface de arquivamento e restauração", () => {
  const archived = {
    archivedAt: new Date("2026-11-06T12:00:00Z"), archivedById: admin.id,
    archiveReason: "Processo suspenso", archivedBy: { name: admin.name },
  };

  it("exibe autor, data e motivo sem oferecer ações do ciclo", () => {
    openModal(archived, admin);
    expect(screen.getByRole("region", { name: "Arquivamento" }).textContent).toContain("Processo suspenso");
    expect(screen.getByRole("region", { name: "Arquivamento" }).textContent).toContain("Alice Gestora");
    for (const name of ["Editar", "Confirmar Conclusão", "Validar e Finalizar", "Arquivar tarefa"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Restaurar tarefa" })).toBeTruthy();
  });

  it("visualizador consulta o arquivo sem poder restaurar", () => {
    openModal(archived, { ...operator, role: "VIEWER" });
    expect(screen.getByText("Tarefa arquivada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Restaurar tarefa" })).toBeNull();
  });

  it("falha na restauração mantém modal aberto e permite nova tentativa", async () => {
    actions.restoreTask.mockResolvedValueOnce({ success: false, message: "Falha ao restaurar" });
    const { user, onClose } = openModal(archived, admin);
    await user.click(screen.getByRole("button", { name: "Restaurar tarefa" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Falha ao restaurar");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Restaurar tarefa" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(actions.restoreTask).toHaveBeenCalledWith("task");
  });

  it("motivo é obrigatório e fica preservado enquanto arquiva", async () => {
    let finish!: (state: FormState) => void;
    actions.archiveTask.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, onClose } = openModal({}, admin);
    await user.click(screen.getByRole("button", { name: "Arquivar tarefa" }));
    await user.click(screen.getByRole("button", { name: "Confirmar arquivamento" }));
    expect(actions.archiveTask).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Motivo do arquivamento"), "Processo suspenso");
    await user.click(screen.getByRole("button", { name: "Confirmar arquivamento" }));
    expect(screen.getByRole("button", { name: "Arquivando..." })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Motivo do arquivamento")).toHaveProperty("value", "Processo suspenso");
    await act(async () => finish({ success: true, message: "Arquivada" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(actions.archiveTask).toHaveBeenCalledTimes(1);
  });
});

describe("acessibilidade do modal", () => {
  it("identifica diálogo e fecha por Escape", async () => {
    const { user, onClose } = openModal();
    expect(screen.getByRole("dialog", { name: "Tarefa" }).getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("mantém Tab no diálogo e restaura foco e rolagem ao fechar", async () => {
    const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
    const { unmount } = render(<TaskModal task={taskFixture()} isOpen onClose={vi.fn()} currentUser={operator} employees={employees} />);
    const user = userEvent.setup();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar tarefa" }));
    await user.tab({ shift: true });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    unmount(); expect(document.activeElement).toBe(trigger); expect(document.body.style.overflow).toBe(""); trigger.remove();
  });
});
