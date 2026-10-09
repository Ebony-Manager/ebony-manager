import { describe, expect, it } from "vitest";

import { selectAllRows } from "./select-all";

/** Tabla falsa que, como Supabase, entrega como máximo 1,000 filas por página. */
function fakeTable(n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  let calls = 0;
  return {
    calls: () => calls,
    page: async (from: number, to: number) => {
      calls++;
      return { data: rows.slice(from, Math.min(to, from + 999) + 1), error: null };
    },
  };
}

describe("selectAllRows", () => {
  it("trae TODAS las filas aunque la tabla pase de 1,000", async () => {
    const t = fakeTable(2345);
    const all = await selectAllRows(t.page);
    expect(all).toHaveLength(2345);
    expect(all[0]).toEqual({ id: 0 });
    expect(all[2344]).toEqual({ id: 2344 });
    expect(t.calls()).toBe(3);
  });
  it("tabla con exactamente 1,000 filas: pide una página más para confirmar el final", async () => {
    const t = fakeTable(1000);
    expect(await selectAllRows(t.page)).toHaveLength(1000);
    expect(t.calls()).toBe(2);
  });
  it("tabla vacía o corta: una sola llamada", async () => {
    const t = fakeTable(7);
    expect(await selectAllRows(t.page)).toHaveLength(7);
    expect(t.calls()).toBe(1);
  });
  it("propaga el error de la base", async () => {
    await expect(selectAllRows(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
