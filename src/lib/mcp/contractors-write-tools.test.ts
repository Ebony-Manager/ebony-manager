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
}));
vi.mock("@/services/contractors", () => svc);
vi.mock("@/lib/integrations/record", () => ({ recordRun: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/contractors/contractor-loans", () => ({ todayInPanama: () => "2026-11-09" }));

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
