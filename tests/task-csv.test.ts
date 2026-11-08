import { describe, expect, it } from "vitest";
import { csvCell, tasksToCsv } from "../src/lib/task-csv";
import { taskFixture } from "./helpers/fixtures";

describe("CSV", () => {
  it("escapa separadores, aspas e quebras de linha", () => {
    expect(csvCell('Texto; "com aspas"\ne detalhe')).toBe('"Texto; ""com aspas""\ne detalhe"');
  });
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "  =1", "\ttexto", "\rtexto", "\ntexto"])("neutraliza início potencialmente interpretável como fórmula: %j", (value) => {
    expect(csvCell(value)).toBe(`"'${value}"`);
  });
  it("inclui BOM, cabeçalhos e rótulos em português", () => {
    const csv = tasksToCsv([taskFixture({ title: "Relatório", frequency: "MONTHLY" })]);
    expect(csv.startsWith('\uFEFF"Título";"Descrição"')).toBe(true);
    expect(csv).toContain('"Relatório";"Conferir os documentos";"05/11/2026";"Pendente";"Mensal";"Alice Gestora"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("consulta vazia exporta somente cabeçalho", () => { expect(tasksToCsv([]).split("\r\n")).toHaveLength(2); });
});
