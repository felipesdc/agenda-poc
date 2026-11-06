import { describe, expect, it } from "vitest";
import { archiveReasonSchema } from "../src/lib/archive-input";

describe("motivo do arquivamento", () => {
  it("remove espaços das extremidades e mantém o motivo informado", () => {
    expect(archiveReasonSchema.parse("  Processo suspenso  ")).toBe("Processo suspenso");
  });
  it("aceita os limites de 3 e 500 caracteres", () => {
    expect(archiveReasonSchema.safeParse("abc").success).toBe(true);
    expect(archiveReasonSchema.safeParse("a".repeat(500)).success).toBe(true);
  });
  it.each([
    ["ausente", undefined], ["nulo", null], ["número", 123], ["objeto", {}],
    ["vazio", ""], ["só espaços", "   "], ["muito curto", "ab"], ["muito longo", "a".repeat(501)],
  ])("recusa motivo %s", (_label, value) => {
    expect(archiveReasonSchema.safeParse(value).success).toBe(false);
  });
});
