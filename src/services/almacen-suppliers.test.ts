import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
import { assignItemSupplier } from "./almacen";

const old = { item_id: "item", supplier_id: "old", is_primary: true, pack_label: "Caja", pack_qty: 100, supplier_ref: "REF", notes: "Conservar" };
const selected = { ...old, supplier_id: "new", is_primary: false, pack_qty: 50 };

function mockClient(links = [old, selected], supplierError: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const supplier = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: supplierError ? null : { id: "new" }, error: supplierError }) };
  const relations = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: links, error: null }), upsert };
  createClient.mockResolvedValue({ from: (table: string) => table === "suppliers" ? supplier : relations });
  return upsert;
}

beforeEach(() => vi.clearAllMocks());

describe("assign supplier from inventory review", () => {
  it("preserves packaging and references and promotes the selected supplier last in a single write", async () => {
    const upsert = mockClient();
    await assignItemSupplier("item", "new", true);
    expect(upsert).toHaveBeenCalledExactlyOnceWith([
      { ...old, is_primary: false }, { ...selected, is_primary: true },
    ], { onConflict: "item_id,supplier_id" });
  });
  it("adds a new primary while retaining the previous supplier", async () => {
    const upsert = mockClient([old]);
    await assignItemSupplier("item", "new", true);
    const rows = upsert.mock.calls[0][0];
    expect(rows[0]).toEqual({ ...old, is_primary: false });
    expect(rows[1]).toMatchObject({ supplier_id: "new", is_primary: true, pack_qty: null });
  });
  it("adding an alternative does not overwrite an existing supplier or its primary flag", async () => {
    const upsert = mockClient();
    await assignItemSupplier("item", "old", false);
    expect(upsert).toHaveBeenCalledWith(expect.anything(), { onConflict: "item_id,supplier_id", ignoreDuplicates: true });
  });
  it("does not write if the supplier cannot be selected", async () => {
    const upsert = mockClient([], { message: "Proveedor inactivo" });
    await expect(assignItemSupplier("item", "new", true)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it("reports a failed database write", async () => {
    const upsert = mockClient();
    upsert.mockResolvedValue({ error: { message: "Conflicto" } });
    await expect(assignItemSupplier("item", "new", true)).rejects.toThrow();
  });
});
