import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

vi.mock("server-only", () => ({}));
const svc = vi.hoisted(() => ({ getContractorClosing: vi.fn(), setContractorPayLine: vi.fn(), closeContractorPayPeriod: vi.fn() }));
vi.mock("@/services/contractors", () => svc);
vi.mock("@/lib/integrations/record", () => ({ recordRun: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/contractors/contractor-loans", async (orig) => ({
  ...(await orig<typeof import("@/lib/contractors/contractor-loans")>()),
  todayInPanama: () => "2026-11-19",
}));

import { registerContractorClosingTools } from "./contractors-closing-tools";
import type { McpUser } from "./auth";

async function connect(modules: string[] = ["documentos", "contratistas"]) {
  const server = new McpServer({ name: "t", version: "1" });
  registerContractorClosingTools(server, { id: "u1", email: "a@b.c", clientId: null, profile: { role: "vendedor", modules } } as unknown as McpUser);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const body = (r: unknown) => (r as { content: { text: string }[] }).content[0].text;
const json = (r: unknown) => JSON.parse(body(r));

const contract = { id: "k1", contractorId: "c1", contractorName: "Erick Vanegas", projectId: "p1", projectName: "Golden Palace", name: "Cocina", contractDate: "2026-10-01", status: "ACTIVE", notes: null, valueCents: 100000, allocatedCents: 40000, retentionCents: 0 };
// Erick: contrato con $600 por pagar y una cuota de $50 a cuenta (fechada antes del día de pago).
function closing(over: Partial<Record<string, unknown>> = {}) {
  return {
    period: { id: "per1", year: 2026, month: 11, half: 2, payDate: "2026-11-30", status: "draft", paidAt: null },
    payDate: "2026-11-30",
    lines: [],
    results: [],
    contractors: [
      { id: "c1", name: "Erick Vanegas", contractorType: "ebanista", status: "ACTIVE", photoPath: null },
      { id: "c2", name: "Pedro Pintor", contractorType: "pintor", status: "ACTIVE", photoPath: null },
    ],
    contracts: [contract],
    entries: [{ id: "q1", contractorId: "c1", entryDate: "2026-11-16", category: "prestamo", direction: "reduce", amountCents: 5000, contractId: null, ebonyAbsorbsMaterial: false, description: "Préstamo · cuota 1 de 2", loanId: "l1" }],
    allocations: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  svc.getContractorClosing.mockResolvedValue(closing());
});

describe("MCP · quincena de contratistas", () => {
  it("muestra lo que se puede pagar y lo que está a cuenta; Pedro sin nada por pagar no sale", async () => {
    const client = await connect();
    const d = json(await client.callTool({ name: "quincena_contratistas", arguments: {} }));
    expect(svc.getContractorClosing).toHaveBeenCalledWith(2026, 11, 2);
    expect(d.estado).toBe("BORRADOR");
    expect(d.contratistas).toHaveLength(1);
    expect(d.contratistas[0]).toMatchObject({ contratista: "Erick Vanegas", a_cuenta_por_descontar: 50, abonos: 0, efectivo_a_entregar: 0 });
    expect(d.contratistas[0].contratos[0]).toMatchObject({ contrato_id: "k1", se_puede_pagar: 600 });
  });

  it("preparar: vista previa con el efectivo; guarda solo con el código; no deja pasar el tope", async () => {
    const client = await connect();
    const args = { abonos: [{ contratista: "erick", contrato_id: "k1", monto: 300 }] };
    const prev = json(await client.callTool({ name: "preparar_quincena_contratistas", arguments: args }));
    expect(prev.cambios).toEqual([{ contratista: "Erick Vanegas", abonos_antes: 0, abonos_despues: 300, se_descuenta: 50, efectivo_a_entregar: 250 }]);
    expect(svc.setContractorPayLine).not.toHaveBeenCalled();

    const bad = await client.callTool({ name: "preparar_quincena_contratistas", arguments: { abonos: [{ contratista: "erick", contrato_id: "k1", monto: 301 }], confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(bad.isError).toBe(true);

    await client.callTool({ name: "preparar_quincena_contratistas", arguments: { ...args, confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(svc.setContractorPayLine).toHaveBeenCalledWith({ year: 2026, month: 11, half: 2, contractorId: "c1", contractId: "k1", amountCents: 30000 });

    const tooMuch = await client.callTool({ name: "preparar_quincena_contratistas", arguments: { abonos: [{ contratista: "erick", contrato_id: "k1", monto: 600.01 }] } });
    expect(tooMuch.isError).toBe(true);
    expect(body(tooMuch)).toContain("hasta $600.00");
  });

  it("pagar: vista previa sin pagar; con el código paga; si el borrador cambió, no paga", async () => {
    svc.getContractorClosing.mockResolvedValue(closing({ lines: [{ contractorId: "c1", contractId: "k1", amountCents: 30000 }] }));
    const client = await connect();
    const prev = json(await client.callTool({ name: "pagar_quincena_contratistas", arguments: {} }));
    expect(prev.pagos).toEqual([{ contratista: "Erick Vanegas", abonos: 300, se_descuenta: 50, efectivo_a_entregar: 250 }]);
    expect(prev.totales.efectivo_a_entregar).toBe(250);
    expect(svc.closeContractorPayPeriod).not.toHaveBeenCalled();

    // Alguien cambió el borrador entre la vista previa y el sí.
    svc.getContractorClosing.mockResolvedValueOnce(closing({ lines: [{ contractorId: "c1", contractId: "k1", amountCents: 40000 }] }));
    const changed = await client.callTool({ name: "pagar_quincena_contratistas", arguments: { confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(changed.isError).toBe(true);
    expect(svc.closeContractorPayPeriod).not.toHaveBeenCalled();

    const done = await client.callTool({ name: "pagar_quincena_contratistas", arguments: { confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(done.isError).toBeFalsy();
    expect(svc.closeContractorPayPeriod).toHaveBeenCalledWith("per1");
  });

  it("no paga una quincena sin borrador, ya pagada, o sin permiso", async () => {
    const client = await connect();
    expect((await client.callTool({ name: "pagar_quincena_contratistas", arguments: {} })).isError).toBe(true);
    svc.getContractorClosing.mockResolvedValue(closing({ period: { id: "per1", year: 2026, month: 11, half: 2, payDate: "2026-11-30", status: "paid", paidAt: "x" } }));
    expect((await client.callTool({ name: "pagar_quincena_contratistas", arguments: {} })).isError).toBe(true);
    expect((await client.callTool({ name: "preparar_quincena_contratistas", arguments: { abonos: [{ contratista: "erick", contrato_id: "k1", monto: 1 }] } })).isError).toBe(true);
    const noPerm = await connect(["almacen"]);
    expect((await noPerm.callTool({ name: "quincena_contratistas", arguments: {} })).isError).toBe(true);
    expect(svc.closeContractorPayPeriod).not.toHaveBeenCalled();
  });
});
