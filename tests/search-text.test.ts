import { describe, expect, it } from "vitest";
import { normalizeSearchText } from "../src/lib/search-text";
import { migrationStatements } from "./helpers/migrations";

describe("busca normalizada", () => {
  it.each([
    ["Relatório de Validação", "relatorio de validacao"],
    ["AÇÃO E REUNIÃO", "acao e reuniao"],
    ["Órgão, útil, frequência, amanhã", "orgao, util, frequencia, amanha"],
    ["Café / CAFÉ / cafe", "cafe / cafe / cafe"],
    ["reuni\u0061\u0303o", "reuniao"],
    ["123 - teste!", "123 - teste!"],
  ])("normaliza %s preservando pontuação", (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
    expect(normalizeSearchText(normalizeSearchText(input))).toBe(expected);
  });
  it("preserva o corpo de triggers ao separar migrações", () => {
    const trigger = "CREATE TRIGGER sample AFTER INSERT ON Task BEGIN SELECT 1; SELECT 2; END;";
    const result = migrationStatements(`ALTER TABLE Task ADD COLUMN test TEXT;\n-- statement-breakpoint\n${trigger}`);
    expect(result).toHaveLength(2); expect(result[1]).toBe(trigger);
  });
});
