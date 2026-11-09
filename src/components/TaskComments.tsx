"use client";

import { useEffect, useId, useRef, useState } from "react";
import { format } from "date-fns";
import { addTaskComment, getTaskComments, type CommentPage } from "@/actions/task-comments";

export default function TaskComments({ taskId, canComment }: { taskId: string; canComment: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CommentPage | null>(null);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const currentRequest = ++requestId.current;
    async function load() {
      setLoading(true);
      try {
        const result = await getTaskComments(taskId, page);
        if (!cancelled && currentRequest === requestId.current) setData(result);
      } catch {
        if (!cancelled && currentRequest === requestId.current) setData({ success: false, message: "Não foi possível carregar. Tente novamente.", comments: [], total: 0, page: 1, pages: 1 });
      } finally { if (!cancelled && currentRequest === requestId.current) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [taskId, open, page, version]);

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setMessage(null);
    try {
      const result = await addTaskComment(taskId, body);
      setMessage({ text: result.message, error: !result.success });
      if (result.success) { setBody(""); setPage(1); setVersion((value) => value + 1); }
    } catch { setMessage({ text: "Não foi possível publicar. Tente novamente.", error: true }); }
    finally { inFlight.current = false; setPending(false); editorRef.current?.focus(); }
  }

  return <section aria-labelledby={`${id}-heading`} className="space-y-3 border-t pt-4">
    <h4 id={`${id}-heading`}><button type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen((value) => !value)} className="min-h-11 rounded px-2 text-sm font-semibold hover:bg-muted">{open ? "Ocultar comentários" : "Ver comentários"}</button></h4>
    <div id={`${id}-content`} hidden={!open} className="space-y-4">
      <p className="text-xs text-gray-600">Conversa da equipe, separada do histórico automático. Comentários publicados são preservados.</p>
      {canComment ? <form aria-label="Adicionar comentário" onSubmit={publish} className="space-y-2">
        <label htmlFor={`${id}-body`} className="block text-sm font-medium">Comentário</label>
        <textarea ref={editorRef} id={`${id}-body`} value={body} onChange={(event) => setBody(event.target.value)} required maxLength={2000} rows={3} disabled={pending} aria-describedby={`${id}-limit`} className="w-full rounded border p-2 text-sm" />
        <p id={`${id}-limit`} className="text-xs text-gray-600">{body.length}/2.000 caracteres</p>
        <button type="submit" disabled={pending || !body.trim()} className="min-h-11 rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "Publicando..." : "Publicar comentário"}</button>
      </form> : <p className="text-sm text-gray-600">Comentários disponíveis somente para leitura neste perfil ou em tarefas arquivadas.</p>}
      {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-red-700 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>{message.text}</p>}
      <div aria-busy={loading} className="space-y-3">
        {loading && <p role="status" className="text-sm text-gray-600">Carregando comentários...</p>}
        {!loading && data && !data.success && <div role="alert" className="text-sm"><p>{data.message}</p><button type="button" onClick={() => setVersion((value) => value + 1)} className="min-h-11 underline">Tentar novamente</button></div>}
        {!loading && data?.success && <>
          <p className="text-sm text-gray-600">{data.total === 0 ? "Nenhum comentário publicado." : `${data.total} comentário(s) · Mais recentes primeiro`}</p>
          <ul aria-label="Comentários da tarefa" className="space-y-3">{data.comments.map((comment) => <li key={comment.id} className="rounded-lg border bg-gray-50 p-3 text-sm">
            <p className="font-semibold break-words">{comment.authorName}</p><time dateTime={new Date(comment.createdAt).toISOString()} className="text-xs text-gray-600">{format(new Date(comment.createdAt), "dd/MM/yyyy 'às' HH:mm")}</time>
            <p className="mt-2 whitespace-pre-wrap break-words">{comment.body}</p>
          </li>)}</ul>
          {data.pages > 1 && <nav aria-label="Paginação dos comentários" className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" disabled={data.page <= 1 || pending} onClick={() => setPage(data.page - 1)} className="min-h-11 rounded border px-3 disabled:opacity-50">Mais recentes</button>
            <span>Página {data.page} de {data.pages}</span>
            <button type="button" disabled={data.page >= data.pages || pending} onClick={() => setPage(data.page + 1)} className="min-h-11 rounded border px-3 disabled:opacity-50">Mais antigos</button>
          </nav>}
        </>}
      </div>
    </div>
  </section>;
}
