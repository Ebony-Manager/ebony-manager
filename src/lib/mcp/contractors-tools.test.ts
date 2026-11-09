import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

vi.mock("server-only", () => ({}));
const svc = vi.hoisted(() => ({
  getContractors: vi.fn(),
  getContractorsDashboardInput: vi.fn(),
  getContracts: vi.fn(),
  getContractorLedger: vi.fn(),
  getContractWork: vi.fn(),
  getContractorAllocations: vi.fn(),
  getContractorLoans: vi.fn(),
  getLaborRates: vi.fn(),
  getProjects: vi.fn(),
}));
vi.mock("@/services/contractors", () => svc);
const recordRun = vi.hoisted(() => vi.fn());
vi.mock("@/lib/integrations/record", () => ({ recordRun }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));

import { registerContractorTools } from "./contractors-tools";
import type { McpUser } from "./auth";

const juan = { id: "c1", name: "Juan Pérez", contractorType: "ebanista", status: "ACTIVE" };
const entry = (over: Record<string, unknown>) => ({
  id: "e" + Math.random(),
  contractorId: "c1",
  projectId: null,
  projectName: null,
  entryDate: "2026-10-01",
  category: "trabajo",
  direction: "a_favor",
  mt2: null,
  costPerMt2Cents: null,
  amountCents: 100000,
  ebonyAbsorbsMaterial: false,
  clientText: null,
  description: null,
  notes: null,
  itemsSummary: null,
  loanId: null,
  contractId: null,
  contractName: null,
  ...over,
});

async function connect(modules: string[], role: "admin" | "vendedor" = "vendedor") {
  const server = new McpServer({ name: "t", version: "1" });
  const user = { id: "u1", email: "a@b.c", clientId: null, profile: { role, modules } } as unknown as McpUser;
  registerContractorTools(server, user);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const text = (r: unknown) => (r as { content: { text: string }[] }).content[0].text;

beforeEach(() => {
  vi.clearAllMocks();
  svc.getContractors.mockResolvedValue([juan, { ...juan, id: "c2", name: "Juan Carlos Ruiz" }]);
});

describe("MCP · Contratistas", () => {
  it("ofrece las herramientas de consulta (todas de solo lectura)", async () => {
    const client = await connect(["documentos", "contratistas"]);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["contratos", "detalle_contrato", "estado_de_cuenta", "guia_contratistas", "listar_contratistas", "prestamos_contratista", "proyectos", "tarifas_mano_de_obra"].sort()
    );
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it("sin el permiso de Contratistas no devuelve datos", async () => {
    const client = await connect(["cotizacion"]);
    const r = await client.callTool({ name: "estado_de_cuenta", arguments: { contratista: "Juan Pérez" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("permiso de Contratistas");
    expect(svc.getContractorLedger).not.toHaveBeenCalled();
    expect(recordRun).toHaveBeenCalledWith(expect.anything(), null, "mcp", false, expect.stringContaining("estado_de_cuenta"));
  });

  it("estado de cuenta: saldo corrido, y las cuotas futuras aparte (no cuentan)", async () => {
    svc.getContractorLedger.mockResolvedValue([
      entry({ amountCents: 100000 }),
      entry({ category: "pago", direction: "reduce", amountCents: 30000, entryDate: "2026-10-15" }),
      entry({ category: "prestamo", direction: "reduce", amountCents: 5000, entryDate: "2099-01-15", loanId: "l1" }),
    ]);
    const client = await connect(["documentos", "contratistas"]);
    const r = await client.callTool({ name: "estado_de_cuenta", arguments: { contratista: "juan perez" } });
    const data = JSON.parse(text(r));
    expect(data.saldo_hoy).toBe(700);
    expect(data.movimientos.map((m: { saldo_despues: number }) => m.saldo_despues)).toEqual([1000, 700]);
    expect(data.cuotas_programadas_a_futuro).toHaveLength(1);
  });

  it("si el nombre coincide con varios, pide aclarar", async () => {
    const client = await connect([], "admin");
    const r = await client.callTool({ name: "prestamos_contratista", arguments: { contratista: "Juan" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("Hay varios contratistas");
  });

  it("contratos: valor, abonado, falta y lo que se puede pagar hoy", async () => {
    svc.getContracts.mockResolvedValue([
      { id: "k1", contractorId: "c1", contractorName: "Juan Pérez", projectId: "p1", projectName: "Costa del Este", name: "Cocina", contractDate: "2026-10-01", status: "ACTIVE", notes: null, valueCents: 200000, allocatedCents: 50000, retentionCents: 10000 },
    ]);
    const client = await connect([], "admin");
    const r = await client.callTool({ name: "contratos", arguments: { contratista: "Juan Pérez" } });
    const k = JSON.parse(text(r)).contratos[0];
    expect(k).toMatchObject({ valor: 2000, abonado: 500, falta_por_pagar: 1500, retenido_garantia: 100, se_puede_pagar_hoy: 1400, avance_de_pago_pct: 25 });
  });
});
