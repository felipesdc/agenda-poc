import { test } from "vitest";
import assert from "node:assert/strict";
import { parseTaskFormData } from "../src/lib/task-input";
import { frequencyLabels } from "../src/lib/task-frequency";

function form(overrides: Record<string, string | string[] | null> = {}) {
  const fields = { title: "Enviar remessa", dueDate: "2026-11-05", ...overrides };
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== null) for (const entry of Array.isArray(value) ? value : [value]) data.append(name, entry);
  }
  return data;
}

test("cadastro sem periodicidade usa NONE e aceita campos opcionais ausentes", () => {
  const result = parseTaskFormData(form());
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, { title: "Enviar remessa", dueDate: "2026-11-05", description: "", frequency: "NONE", focalPoints: [] });
});

test("aceita todas as periodicidades oferecidas e preserva pontos focais únicos", () => {
  for (const frequency of Object.keys(frequencyLabels)) {
    const result = parseTaskFormData(form({ frequency, focalPoints: ["1001", "1002", "1001"], title: "  Revisar tarefa  " }));
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.frequency, frequency);
      assert.equal(result.data.title, "Revisar tarefa");
      assert.deepEqual(result.data.focalPoints, [1001, 1002]);
    }
  }
});

test("rejeita datas inexistentes e formatos que quebrariam a persistência", () => {
  for (const dueDate of ["", "2026-02-29", "2026-04-31", "2026-13-01", "05/11/2026", "2026-11-05T12:00:00Z"]) {
    const result = parseTaskFormData(form({ dueDate }));
    assert.equal(result.success, false, dueDate);
    if (!result.success) assert.ok(result.error.flatten().fieldErrors.dueDate);
  }
  assert.equal(parseTaskFormData(form({ dueDate: "2028-02-29" })).success, true);
});

test("rejeita título vazio, frequência desconhecida e matrículas malformadas", () => {
  for (const title of ["   ", "ab"]) assert.equal(parseTaskFormData(form({ title })).success, false);
  assert.equal(parseTaskFormData(form({ frequency: "DAILY" })).success, false);
  for (const id of ["", "0", "-1", "1.5", "NaN", "1e3", "2147483648"]) {
    const result = parseTaskFormData(form({ focalPoints: [id] }));
    assert.equal(result.success, false, id);
    if (!result.success) assert.ok(result.error.flatten().fieldErrors.focalPoints);
  }
});

test("rejeita arquivos em campos de texto e matrículas", () => {
  for (const field of ["title", "dueDate", "frequency", "focalPoints"]) {
    const data = form();
    data.set(field, new Blob(["1001"]), "entrada.txt");
    assert.equal(parseTaskFormData(data).success, false, field);
  }
});
