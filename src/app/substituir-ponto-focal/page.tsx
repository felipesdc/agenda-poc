import Link from "next/link";
import FocalReplacementForm from "@/components/FocalReplacementForm";
import { getFocalReplacementOptions } from "@/lib/focal-replacement";
export const dynamic = "force-dynamic";
export default async function FocalReplacementPage() {
  const options = await getFocalReplacementOptions();
  if (!options) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl space-y-4 p-8"><h1 className="text-2xl font-bold">Substituir ponto focal</h1><p>A substituição está disponível para gestores e operadores identificados.</p><Link href="/" className="underline">Voltar à agenda</Link></main>;
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl space-y-6 p-4 text-gray-900 sm:p-8">
    <Link href="/tarefas" className="text-blue-700 underline dark:text-blue-300">Voltar à lista de tarefas</Link>
    <h1 className="text-2xl font-bold">Substituir ponto focal</h1>
    <p>Troque uma pessoa por outra nas tarefas pendentes e não arquivadas desta unidade com prazo a partir de hoje. Confira a lista antes de confirmar.</p>
    <p className="text-sm text-gray-600">Tarefas vencidas, concluídas, validadas e arquivadas ficam fora da operação. A alteração é registrada no histórico de cada tarefa. Até 200 tarefas são atualizadas por vez.</p>
    {options.sources.length === 0 ? <p className="rounded border bg-surface p-4">Não há pontos focais em tarefas pendentes com prazo a partir de hoje nesta unidade.</p> : <FocalReplacementForm sources={options.sources} destinations={options.destinations} />}
  </main>;
}
