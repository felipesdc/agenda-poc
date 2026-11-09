"use client";

import { useState, useRef, useEffect, useEffectEvent, useId } from "react";
import { Task, TaskHistory, User, Employee } from "@prisma/client"; // Importe os tipos
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  Archive,
  ArchiveRestore,
  Edit2,
  Save,
  XCircle,
  Loader2,
  History,
  FileText,
  Clock,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { useActionState } from "react";
import { createTask, updateTask, archiveTask, restoreTask, completeTask, validateTask } from "@/actions";
import { canWriteTasks, canArchiveTask, canRestoreTask, canEditTask, canValidateTask } from "@/lib/permissions";
import TaskFields from "./TaskFields";
import TaskComments from "./TaskComments";
import { frequencyLabels as frequencyMap } from "@/lib/task-frequency";
import type { FormState } from "@/actions";
import { getTaskStatusColor, colorMap, cn } from "@/lib/utils";

// Tipo estendido para incluir o histórico que buscamos no page.tsx
export type TaskWithHistory = Task & {
  history: (TaskHistory & { user: User })[];
  focalPoints: Employee[]; // <--- Novo campo
  archivedBy?: { name: string } | null;
};

interface TaskModalProps {
  task: TaskWithHistory; // Usando o novo tipo
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null; // <--- Nova prop
  employees: Employee[]; // <--- Lista completa para o select
}

const initialState: FormState = { message: "", errors: {}, success: false };

export default function TaskModal({
  task,
  isOpen,
  onClose,
  currentUser,
  employees,
}: TaskModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [pendingAction, setPendingAction] = useState<"archive" | "restore" | "complete" | "validate" | null>(null);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [actionError, setActionError] = useState("");
  const actionInFlight = useRef(false);

  const [state, formAction, isPending] = useActionState(async (previous: FormState, data: FormData): Promise<FormState> => {
    try {
      const result = isDuplicating ? await createTask(previous, data) : await updateTask(task.id, previous, data);
      if (result.success) onClose();
      return result;
    } catch {
      return { success: false, message: "Não foi possível salvar. Tente novamente." };
    }
  }, initialState);
  const isBusy = isPending || pendingAction !== null;
  const isArchiving = pendingAction === "archive";
  const isRestoring = pendingAction === "restore";
  const isCompleting = pendingAction === "complete";
  const isValidating = pendingAction === "validate";
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogTitleId = useId();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const duplicateButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const closeFromKeyboard = useEffectEvent(() => { if (!isBusy) onClose(); });
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeFromKeyboard(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter((element) => element.tabIndex >= 0 && !element.closest("[hidden]"));
      const first = elements[0]; const last = elements.at(-1);
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isOpen]);

  function selectTab(tab: "details" | "history") {
    setActiveTab(tab);
    document.getElementById(`${dialogTitleId}-${tab}-tab`)?.focus();
  }
  useEffect(() => {
    if (isEditing) dialogRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
    else if (!isEditing && wasEditing.current) (editButtonRef.current ?? duplicateButtonRef.current)?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);

  const runAction = async (action: "archive" | "restore" | "complete" | "validate") => {
    if (actionInFlight.current || isPending) return;
    actionInFlight.current = true;
    setPendingAction(action);
    setActionError("");
    try {
      const actions = {
        archive: () => archiveTask(task.id, archiveReason),
        restore: () => restoreTask(task.id),
        complete: () => completeTask(task.id),
        validate: () => validateTask(task.id),
      };
      const result = await actions[action]();
      if (result.success) onClose();
      else setActionError(result.message);
    } catch {
      setActionError("Não foi possível realizar a operação. Tente novamente.");
    } finally {
      actionInFlight.current = false;
      setPendingAction(null);
    }
  };
  const handleRestore = () => runAction("restore");
  const handleComplete = () => runAction("complete");
  const handleValidate = () => runAction("validate");

  if (!isOpen) return null;

  const statusColorKey = getTaskStatusColor(
    new Date(task.dueDate),
    task.status
  );
  const headerColorClass = colorMap[statusColorKey].card.split(" hover:")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} tabIndex={-1} className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh] outline-none">
        {/* Header com Abas */}
        <div className={cn("px-6 pt-4 pb-0 border-b", headerColorClass)}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 id={dialogTitleId} className="text-lg font-bold text-gray-900">{isDuplicating ? "Duplicar tarefa" : "Tarefa"}</h3>
              <span className="text-xs font-medium uppercase opacity-90 tracking-wider">
                {{ PENDING: "Pendente", COMPLETED: "Concluída", VALIDATED: "Validada" }[task.status]}
              </span>
            </div>
            <button
              onClick={onClose}
              disabled={isBusy}
              aria-label="Fechar tarefa"
              className="min-h-11 min-w-11 flex items-center justify-center hover:bg-black/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Navegação de Abas */}
          <div role="tablist" aria-label="Informações da tarefa" className="flex gap-4" onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || isBusy) return;
            event.preventDefault();
            selectTab(event.key === "Home" ? "details" : event.key === "End" ? "history" : activeTab === "details" ? "history" : "details");
          }}>
            <button
              id={`${dialogTitleId}-details-tab`} role="tab" aria-selected={activeTab === "details"} aria-controls={`${dialogTitleId}-details-panel`} tabIndex={activeTab === "details" ? 0 : -1} disabled={isBusy}
              onClick={() => selectTab("details")}
              className={cn(
                "min-h-11 pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "details"
                  ? "border-gray-800 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <FileText className="w-4 h-4" /> Detalhes
            </button>
            <button
              id={`${dialogTitleId}-history-tab`} role="tab" aria-selected={activeTab === "history"} aria-controls={`${dialogTitleId}-history-panel`} tabIndex={activeTab === "history" ? 0 : -1} disabled={isBusy}
              onClick={() => selectTab("history")}
              className={cn(
                "min-h-11 pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "history"
                  ? "border-gray-800 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <History className="w-4 h-4" /> Histórico
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto" aria-busy={isBusy}>
          {actionError && <p role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded">{actionError}</p>}
          <div role="tabpanel" tabIndex={0} id={`${dialogTitleId}-details-panel`} aria-labelledby={`${dialogTitleId}-details-tab`} hidden={activeTab !== "details"}>{(
            /* --- CONTEÚDO DA ABA DETALHES --- */
            !isEditing ? (
              // MODO LEITURA
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {task.title}
                  </h2>
                  <div className="flex flex-col gap-1 mt-1 text-sm text-gray-500">
                    <p>
                      Vence em:{" "}
                      <span className="font-medium text-gray-700">
                        {format(new Date(task.dueDate), "dd/MM/yyyy")}
                      </span>
                    </p>
                    <p>
                      Repetição:{" "}
                      <span className="font-medium text-gray-700">
                        {frequencyMap[task.frequency]}
                      </span>
                    </p>
                    {/* --- EXIBIÇÃO DOS PONTOS FOCAIS --- */}
                    <div className="mt-1">
                      <span className="text-gray-500 mr-2">Pontos Focais:</span>
                      {task.focalPoints.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {task.focalPoints.map((emp) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800"
                            >
                              {emp.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">
                          Nenhum definido
                        </span>
                      )}
                    </div>
                    {/* ---------------------------------- */}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap min-h-[80px]">
                  {task.description || (
                    <span className="italic text-gray-400">Sem descrição.</span>
                  )}
                </div>

                {task.archivedAt && <section className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-900 dark:text-amber-300" aria-label="Arquivamento">
                  <p className="font-semibold">Tarefa arquivada</p>
                  <p>Em {format(new Date(task.archivedAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                  <p>Por: {task.archivedBy?.name || task.history.find((log) => log.action === "ARCHIVE" && log.userId === task.archivedById)?.user.name || "Usuário registrado no histórico"}</p>
                  <p className="whitespace-pre-wrap">Motivo: {task.archiveReason}</p>
                </section>}
                {showArchiveForm && canArchiveTask(currentUser, task) && <form
                  onSubmit={(event) => { event.preventDefault(); void runAction("archive"); }}
                  aria-label="Arquivar tarefa"
                  className="p-3 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3"
                >
                  <label className="block text-sm font-medium text-gray-700">
                    Motivo do arquivamento
                    <textarea name="archiveReason" required minLength={3} maxLength={500} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} disabled={isBusy} className="mt-1 w-full border rounded p-2 text-gray-900" />
                  </label>
                  <p className="text-xs text-gray-600">A tarefa sairá da agenda ativa. Seus dados e histórico serão preservados.</p>
                  <div className="flex gap-2">
                    <button type="submit" disabled={isBusy} className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-50">{isArchiving ? "Arquivando..." : "Confirmar arquivamento"}</button>
                    <button type="button" disabled={isBusy} onClick={() => { setShowArchiveForm(false); setActionError(""); }} className="px-3 py-2 rounded bg-gray-100 text-gray-800">Cancelar arquivamento</button>
                  </div>
                </form>}

                <TaskComments key={task.id} taskId={task.id} canComment={canWriteTasks(currentUser) && currentUser?.unitId === task.unitId && !task.archivedAt} />

                {/* --- NOVA ÁREA DE AÇÃO DO CICLO DE VIDA --- */}
                <div className="py-2">
                  {canEditTask(currentUser, task) && (
                    <button
                      onClick={handleComplete}
                      type="button"
                      disabled={isBusy}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                    >
                      {isCompleting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                      Confirmar Conclusão
                    </button>
                  )}

                  {!task.archivedAt && task.status === "COMPLETED" && (
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-sm rounded border border-blue-100 dark:border-blue-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Aguardando validação da gerência.
                      </div>

                      {/* APENAS ADMIN VÊ ESSE BOTÃO */}
                      {canValidateTask(currentUser, task) && (
                        <button
                          onClick={handleValidate}
                          type="button"
                          disabled={isBusy}
                          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
                        >
                          {isValidating ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <ShieldCheck className="w-5 h-5" />
                          )}
                          Validar e Finalizar
                        </button>
                      )}
                    </div>
                  )}

                  {task.status === "VALIDATED" && (
                    <div className="p-4 bg-gray-100 text-gray-500 text-center rounded-lg font-medium border border-gray-200">
                      Ciclo encerrado em{" "}
                      {task.validatedAt
                        ? format(new Date(task.validatedAt), "dd/MM/yyyy")
                        : "-"}
                    </div>
                  )}
                </div>
                {/* ------------------------------------------ */}

                <div className="flex flex-wrap gap-3 pt-4 border-t mt-4">
                  {canWriteTasks(currentUser) && currentUser?.unitId === task.unitId && <button ref={duplicateButtonRef} type="button" disabled={isBusy} onClick={() => { setIsDuplicating(true); setIsEditing(true); }} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Duplicar tarefa</button>}
                  {canEditTask(currentUser, task) && <button
                    disabled={isBusy}
                    ref={editButtonRef} onClick={() => setIsEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>}
                  {canArchiveTask(currentUser, task) && <button
                    type="button"
                    onClick={() => setShowArchiveForm(true)}
                    disabled={isBusy}
                    className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" /> Arquivar tarefa
                  </button>}
                  {canRestoreTask(currentUser, task) && <button
                    type="button"
                    onClick={handleRestore}
                    disabled={isBusy}
                    className="flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />} Restaurar tarefa
                  </button>}
                </div>
              </div>
            ) : (
              // MODO EDIÇÃO
              <form action={formAction} aria-busy={isPending} className="space-y-4">
                {isDuplicating && <p className="text-sm text-gray-600">Revise os dados e escolha um novo prazo. A cópia será pendente, com histórico próprio.</p>}
                <TaskFields key={isDuplicating ? "copy" : "edit"} task={task} clearDueDate={isDuplicating} employees={employees} errors={state.errors} disabled={isBusy} />
                {!state.success && state.message && <p role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded">{state.message}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => { setIsEditing(false); setIsDuplicating(false); }}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> {isDuplicating ? "Criar cópia" : "Salvar"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )
          )}</div>
          <div role="tabpanel" tabIndex={0} id={`${dialogTitleId}-history-panel`} aria-labelledby={`${dialogTitleId}-history-tab`} hidden={activeTab !== "history"}>
            {/* --- CONTEÚDO DA ABA HISTÓRICO (TIMELINE) --- */}
            <div className="space-y-6 pl-2">
              {task.history.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  Nenhum registro encontrado.
                </p>
              ) : (
                task.history.map((log) => (
                  <div
                    key={log.id}
                    className="relative pl-6 border-l-2 border-gray-100 last:border-0 pb-1"
                  >
                    {/* Bolinha da Timeline */}
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(
                          new Date(log.timestamp),
                          "dd 'de' MMM 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </span>
                      <p className="text-sm font-medium text-gray-800 mt-1">
                        {log.action === "CREATE" && "Tarefa Criada"}
                        {log.action === "UPDATE" && "Tarefa Atualizada"}
                        {log.action === "COMPLETE" && "Tarefa Concluída"}
                        {log.action === "VALIDATE" && "Tarefa Validada"}
                        {log.action === "ARCHIVE" && "Tarefa Arquivada"}
                        {log.action === "RESTORE" && "Tarefa Restaurada"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Por: {log.user.name}
                      </p>
                      {log.detail && (
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-2">
                          {log.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
