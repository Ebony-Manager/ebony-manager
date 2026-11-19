import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

vi.mock("server-only", () => ({}));
const svc = vi.hoisted(() => ({
  getContractors: vi.fn(),
  getProjects: vi.fn(),
  getLaborRates: vi.fn(),
  createContract: vi.fn(),
  getContracts: vi.fn(),
  getContractorLedger: vi.fn(),
  getContractorAllocations: vi.fn(),
  registerContractorPayment: vi.fn(),
  createLedgerEntry: vi.fn(),
}));
vi.mock("@/services/contractors", () => svc);
vi.mock("@/lib/integrations/record", () => ({ recordRun: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/contractors/contractor-loans", () => ({
  todayInPanama: () => "2026-11-09",
  isScheduled: (e: { loanId: string | null; entryDate: string }, today: string) => !!e.loanId && e.entryDate > today,
}));

import { registerContractorWriteTools } from "./contractors-write-tools";
import type { McpUser } from "./auth";

async function connect(modules: string[] = ["documentos", "contratistas"]) {
  const server = new McpServer({ name: "t", version: "1" });
  registerContractorWriteTools(server, { id: "u1", email: "a@b.c", clientId: null, profile: { role: "vendedor", modules } } as unknown as McpUser);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const body = (r: unknown) => (r as { content: { text: string }[] }).content[0].text;

beforeEach(() => {
  vi.clearAllMocks();
  svc.getContractors.mockResolvedValue([{ id: "c1", name: "Erick Vanegas", contractorType: "ebanista", status: "ACTIVE" }]);
  svc.getProjects.mockResolvedValue([{ id: "p1", name: "PH Golden Palace 16", status: "ACTIVE" }]);
  svc.getLaborRates.mockResolvedValue([
    { id: "r1", contractorType: "ebanista", fase: "armado", unidad: "m2", descripcion: "Closet", precioCents: 4000, activo: true, orden: 1 },
    { id: "r2", contractorType: "ebanista", fase: "instalacion", unidad: "m2", descripcion: "Closet", precioCents: 1500, activo: true, orden: 2 },
    { id: "r3", contractorType: "pintor", fase: null, unidad: "m2", descripcion: "Closet", precioCents: 999, activo: true, orden: 3 },
  ]);
  svc.createContract.mockResolvedValue("k-new");
});

const contrato = {
  contratista: "erick vanegas",
  proyecto: "Golden Palace",
  nombre: "Closet principal",
  piezas: [
    { descripcion: "Closet", fase: "armado", cantidad: 6.24, detalle: "2.40 × 2.60" },
    { tarifa_id: "r2", cantidad: 6.24 },
  ],
};

describe("MCP · crear contrato", () => {
  it("la vista previa calcula con las tarifas del contratista y no guarda nada", async () => {
    const client = await connect();
    const r = await client.callTool({ name: "crear_contrato", arguments: contrato });
    const data = JSON.parse(body(r));
    expect(data.estado).toContain("VISTA PREVIA");
    expect(data.piezas.map((p: { subtotal: number }) => p.subtotal)).toEqual([249.6, 93.6]);
    expect(data.valor_del_contrato).toBe(343.2);
    expect(data.codigo_confirmacion).toMatch(/^[0-9a-f]{10}$/);
    expect(svc.createContract).not.toHaveBeenCalled();
  });

  it("solo guarda con confirmar y el código de esos mismos datos", async () => {
    const client = await connect();
    const code = JSON.parse(body(await client.callTool({ name: "crear_contrato", arguments: contrato }))).codigo_confirmacion;

    const changed = await client.callTool({ name: "crear_contrato", arguments: { ...contrato, nombre: "Otro", confirmar: true, codigo_confirmacion: code } });
    expect(changed.isError).toBe(true);
    expect(svc.createContract).not.toHaveBeenCalled();

    const r = await client.callTool({ name: "crear_contrato", arguments: { ...contrato, confirmar: true, codigo_confirmacion: code } });
    expect(JSON.parse(body(r)).estado).toBe("CREADO");
    expect(svc.createContract).toHaveBeenCalledWith(
      expect.objectContaining({
        contractorId: "c1",
        projectId: "p1",
        name: "Closet principal",
        contractDate: "2026-11-09",
        work: expect.objectContaining({ amountCents: 34320, items: [expect.objectContaining({ laborRateId: "r1", subtotalCents: 24960, detalle: "2.40 × 2.60" }), expect.objectContaining({ laborRateId: "r2" })] }),
      })
    );
  });

  it("una tarifa ambigua o de otro tipo no se adivina", async () => {
    const client = await connect();
    const r = await client.callTool({ name: "crear_contrato", arguments: { ...contrato, piezas: [{ descripcion: "Closet", cantidad: 2 }] } });
    expect(r.isError).toBe(true);
    expect(body(r)).toContain("varias tarifas");
    const other = await client.callTool({ name: "crear_contrato", arguments: { ...contrato, piezas: [{ tarifa_id: "r3", cantidad: 2 }] } });
    expect(other.isError).toBe(true);
  });

  it("sin el permiso de Contratistas no hace nada", async () => {
    const client = await connect(["cotizacion"]);
    const r = await client.callTool({ name: "crear_contrato", arguments: { ...contrato, confirmar: true, codigo_confirmacion: "x" } });
    expect(r.isError).toBe(true);
    expect(svc.createContract).not.toHaveBeenCalled();
  });
});

describe("MCP · registrar abono", () => {
  beforeEach(() => {
    svc.getContracts.mockResolvedValue([
      { id: "k1", contractorId: "c1", contractorName: "Erick Vanegas", projectId: "p1", projectName: "PH Golden Palace 16", name: "Comedor", contractDate: "2026-10-30", status: "ACTIVE", notes: null, valueCents: 94414, allocatedCents: 0, retentionCents: 0 },
    ]);
    // $100 pagados de más (a cuenta) antes del abono.
    svc.getContractorLedger.mockResolvedValue([
      { id: "s1", contractorId: "c1", entryDate: "2026-11-01", category: "adelanto", direction: "reduce", amountCents: 10000, contractId: null, ebonyAbsorbsMaterial: false },
    ]);
    svc.getContractorAllocations.mockResolvedValue([]);
    svc.registerContractorPayment.mockResolvedValue({ cashCents: 40000, deductedCents: 10000 });
  });

  it("la vista previa descuenta primero lo que está a cuenta y no guarda", async () => {
    const client = await connect();
    const r = await client.callTool({ name: "registrar_abono", arguments: { contratista: "Erick", abonos: [{ contrato_id: "k1", monto: 500 }] } });
    const data = JSON.parse(body(r));
    expect(data).toMatchObject({ total_abonado: 500, se_descuenta_de_lo_que_esta_a_cuenta: 100, efectivo_a_entregar: 400 });
    expect(svc.registerContractorPayment).not.toHaveBeenCalled();

    const ok = await client.callTool({
      name: "registrar_abono",
      arguments: { contratista: "Erick", abonos: [{ contrato_id: "k1", monto: 500 }], confirmar: true, codigo_confirmacion: data.codigo_confirmacion },
    });
    expect(JSON.parse(body(ok)).estado).toBe("REGISTRADO");
    expect(svc.registerContractorPayment).toHaveBeenCalledWith({ contractorId: "c1", date: "2026-11-09", lines: [{ contractId: "k1", amountCents: 50000 }], looseCents: 0, notes: null });
  });

  it("no deja abonar más de lo que se puede pagar hoy", async () => {
    const client = await connect();
    const r = await client.callTool({ name: "registrar_abono", arguments: { contratista: "Erick", abonos: [{ contrato_id: "k1", monto: 2000 }] } });
    expect(r.isError).toBe(true);
    expect(body(r)).toContain("hasta $944.14");
  });
});

describe("MCP · registrar movimiento", () => {
  beforeEach(() => {
    svc.getContracts.mockResolvedValue([
      { id: "k1", contractorId: "c1", contractorName: "Erick Vanegas", projectId: "p1", projectName: "PH Golden Palace 16", name: "Comedor", contractDate: "2026-10-30", status: "ACTIVE", notes: null, valueCents: 50000, allocatedCents: 20000, retentionCents: 0 },
    ]);
    // Saldo de hoy: +$500 (trabajo). La cuota futura todavía no cuenta.
    svc.getContractorLedger.mockResolvedValue([
      { id: "w1", contractorId: "c1", loanId: null, entryDate: "2026-11-01", category: "trabajo", direction: "a_favor", amountCents: 50000, contractId: "k1", ebonyAbsorbsMaterial: false },
      { id: "q1", contractorId: "c1", loanId: "l1", entryDate: "2026-12-15", category: "prestamo", direction: "reduce", amountCents: 9999, contractId: null, ebonyAbsorbsMaterial: false },
    ]);
    svc.createLedgerEntry.mockResolvedValue({ id: "m-new" });
  });

  const material = { contratista: "Erick", tipo: "material", monto: 85.5, descripcion: "2 láminas MDF" };

  it("un material resta: la vista previa muestra el saldo antes y después y no guarda", async () => {
    const client = await connect();
    const data = JSON.parse(body(await client.callTool({ name: "registrar_movimiento", arguments: material })));
    expect(data).toMatchObject({ estado: expect.stringContaining("VISTA PREVIA"), tipo: "Material", monto: 85.5, saldo_hoy: 500, saldo_despues: 414.5 });
    expect(svc.createLedgerEntry).not.toHaveBeenCalled();

    const changed = await client.callTool({ name: "registrar_movimiento", arguments: { ...material, monto: 90, confirmar: true, codigo_confirmacion: data.codigo_confirmacion } });
    expect(changed.isError).toBe(true);
    expect(svc.createLedgerEntry).not.toHaveBeenCalled();

    const r = await client.callTool({ name: "registrar_movimiento", arguments: { ...material, confirmar: true, codigo_confirmacion: data.codigo_confirmacion } });
    expect(JSON.parse(body(r)).estado).toBe("REGISTRADO");
    expect(svc.createLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        contractorId: "c1",
        category: "material",
        direction: "reduce",
        amountCents: 8550,
        entryDate: "2026-11-09",
        ebonyAbsorbsMaterial: false,
        contractId: null,
        allocateToContractId: null,
        description: "2 láminas MDF",
      })
    );
  });

  it("un material abonado a un contrato manda el abono; si Ebony lo asume, no mueve el saldo", async () => {
    const client = await connect();
    const code = JSON.parse(body(await client.callTool({ name: "registrar_movimiento", arguments: { ...material, contrato_id: "k1" } }))).codigo_confirmacion;
    await client.callTool({ name: "registrar_movimiento", arguments: { ...material, contrato_id: "k1", confirmar: true, codigo_confirmacion: code } });
    expect(svc.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ allocateToContractId: "k1", contractId: null }));

    const absorbed = JSON.parse(body(await client.callTool({ name: "registrar_movimiento", arguments: { ...material, ebony_asume: true } })));
    expect(absorbed.saldo_despues).toBe(500);
    const bad = await client.callTool({ name: "registrar_movimiento", arguments: { ...material, ebony_asume: true, contrato_id: "k1" } });
    expect(bad.isError).toBe(true);
  });

  it("un extra suma y va al contrato; por área calcula m² × costo", async () => {
    const client = await connect();
    const args = { contratista: "Erick", tipo: "extra", m2: 2.5, costo_por_m2: 40, contrato_id: "k1" };
    const data = JSON.parse(body(await client.callTool({ name: "registrar_movimiento", arguments: args })));
    expect(data).toMatchObject({ monto: 100, saldo_despues: 600 });
    await client.callTool({ name: "registrar_movimiento", arguments: { ...args, confirmar: true, codigo_confirmacion: data.codigo_confirmacion } });
    expect(svc.createLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ category: "extra", direction: "a_favor", contractId: "k1", mt2: 2.5, costPerMt2Cents: 4000, amountCents: 10000 })
    );
    expect(svc.createLedgerEntry.mock.calls[0][0]).not.toHaveProperty("allocateToContractId");
  });

  it("valida igual que la pantalla", async () => {
    const client = await connect();
    const call = async (a: Record<string, unknown>) => client.callTool({ name: "registrar_movimiento", arguments: { contratista: "Erick", ...a } });
    expect((await call({ tipo: "ajuste", monto: 10 })).isError).toBe(true); // ajuste sin dirección
    expect((await call({ tipo: "material", monto: 10, direccion: "suma" })).isError).toBe(true); // material no se voltea
    expect((await call({ tipo: "trabajo", monto: 10 })).isError).toBe(true); // trabajo sin contrato
    expect((await call({ tipo: "bono", monto: 10, ebony_asume: true })).isError).toBe(true);
    expect((await call({ tipo: "bono", monto: 10, m2: 2, costo_por_m2: 5 })).isError).toBe(true); // monto y área a la vez
    expect((await call({ tipo: "extra", monto: 10, contrato_id: "otro" })).isError).toBe(true); // contrato ajeno
    expect((await call({ tipo: "prestamo", monto: 10 })).isError).toBe(true); // va por Préstamos y descuentos
    const adj = JSON.parse(body(await call({ tipo: "ajuste", monto: 10, direccion: "resta" })));
    expect(adj.saldo_despues).toBe(490);
    expect(svc.createLedgerEntry).not.toHaveBeenCalled();
  });
});
