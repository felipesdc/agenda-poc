"use client";

import { useState, useEffect } from "react";
import { Task, TaskHistory, User, Frequency, Employee } from "@prisma/client"; // Importe os tipos
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  Trash2,
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
import { updateTask, deleteTask, completeTask, validateTask } from "@/actions";
import { getTaskStatusColor, colorMap, cn } from "@/lib/utils";

// Tipo estendido para incluir o histórico que buscamos no page.tsx
type TaskWithHistory = Task & {
  history: (TaskHistory & { user: User })[];
  focalPoints: Employee[]; // <--- Novo campo
};

interface TaskModalProps {
  task: TaskWithHistory; // Usando o novo tipo
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null; // <--- Nova prop
  employees: Employee[]; // <--- Lista completa para o select
}

const initialState = { message: "", errors: {}, success: false };

// Dicionário para traduzir o Enum do banco para Português
const frequencyMap: Record<string, string> = {
  NONE: "Sem repetição",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  EVENTUAL: "Eventual",
};

export default function TaskModal({
  task,
  isOpen,
  onClose,
  currentUser,
  employees,
}: TaskModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false); // Novo state
  const [isValidating, setIsValidating] = useState(false); // Novo state

  const updateTaskWithId = updateTask.bind(null, task.id);
  const [state, formAction, isPending] = useActionState(
    updateTaskWithId,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      setIsEditing(false);
      onClose();
    }
  }, [state.success, onClose]);

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteTask(task.id);
    setIsDeleting(false);
    onClose();
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    await completeTask(task.id);
    setIsCompleting(false);
    onClose();
  };

  const handleValidate = async () => {
    setIsValidating(true);
    await validateTask(task.id);
    setIsValidating(false);
    onClose();
  };

  if (!isOpen) return null;

  const dateForInput = format(new Date(task.dueDate), "yyyy-MM-dd");
  const statusColorKey = getTaskStatusColor(
    new Date(task.dueDate),
    task.status
  );
  const headerColorClass = colorMap[statusColorKey].card.split(" hover:")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header com Abas */}
        <div className={cn("px-6 pt-4 pb-0 border-b", headerColorClass)}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900/80">Tarefa</h3>
              <span className="text-xs font-medium uppercase opacity-60 tracking-wider">
                {task.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-black/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Navegação de Abas */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "details"
                  ? "border-gray-800 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <FileText className="w-4 h-4" /> Detalhes
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === "history"
                  ? "border-gray-800 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <History className="w-4 h-4" /> Histórico
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === "details" ? (
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
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100"
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

                <div className="flex gap-3 pt-4 border-t mt-4">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center justify-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // MODO EDIÇÃO
              <form action={formAction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título
                  </label>
                  <input
                    name="title"
                    defaultValue={task.title}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prazo
                    </label>
                    <input
                      type="date"
                      name="dueDate"
                      defaultValue={dateForInput}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 [color-scheme:light] focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Periodicidade
                    </label>
                    <select
                      name="frequency"
                      defaultValue={task.frequency}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {Object.keys(frequencyMap).map((key) => (
                        <option key={key} value={key}>
                          {frequencyMap[key]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* SELETOR DE PONTOS FOCAIS */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pontos Focais
                  </label>
                  <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto p-2 bg-gray-50">
                    {employees.map((emp) => {
                      // Verifica se já estava selecionado
                      const isChecked = task.focalPoints.some(
                        (fp) => fp.id === emp.id
                      );

                      return (
                        <label
                          key={emp.id}
                          className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            name="focalPoints"
                            value={emp.id}
                            defaultChecked={isChecked}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {emp.email}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selecione quem acompanhará esta tarefa.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={task.description || ""}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap min-h-[80px]">
                  {task.description || (
                    <span className="italic text-gray-400">Sem descrição.</span>
                  )}
                </div>

                {/* --- NOVA ÁREA DE AÇÃO DO CICLO DE VIDA --- */}
                <div className="py-2">
                  {task.status === "PENDING" && (
                    <button
                      onClick={handleComplete}
                      disabled={isCompleting}
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

                  {task.status === "COMPLETED" && (
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 text-blue-800 text-sm rounded border border-blue-100 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Aguardando validação da gerência.
                      </div>

                      {/* APENAS ADMIN VÊ ESSE BOTÃO */}
                      {currentUser?.role === "ADMIN" && (
                        <button
                          onClick={handleValidate}
                          disabled={isValidating}
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

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Salvar
                      </>
                    )}
                  </button>
                </div>
              </form>
            )
          ) : (
            /* --- CONTEÚDO DA ABA HISTÓRICO (TIMELINE) --- */
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
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
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
          )}
        </div>
      </div>
    </div>
  );
}
