import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

vi.mock("server-only", () => ({}));
const cot = vi.hoisted(() => ({ getQuoteSummaries: vi.fn(), getQuote: vi.fn() }));
const ven = vi.hoisted(() => ({ getOpportunities: vi.fn(), getClients: vi.fn(), getOpportunityNotes: vi.fn(), addOpportunityNote: vi.fn() }));
const alm = vi.hoisted(() => ({ getCatalog: vi.fn(), getCategories: vi.fn(), getPendingReturns: vi.fn(), getPurchaseRequests: vi.fn(), getWarehouseProjects: vi.fn(), getInventoryPeople: vi.fn(), registerIssue: vi.fn(), returnContainers: vi.fn() }));
const emp = vi.hoisted(() => ({ getPayrollEmployees: vi.fn() }));
vi.mock("@/services/cotizador", () => cot);
vi.mock("@/services/ventas", () => ven);
vi.mock("@/services/almacen", () => alm);
vi.mock("@/services/payroll-employees", () => emp);
vi.mock("@/services/payroll", () => ({}));
vi.mock("@/services/attendance", () => ({}));
vi.mock("@/services/money-requests", () => ({}));
vi.mock("@/services/taller", () => ({}));
vi.mock("@/services/inspections", () => ({}));
vi.mock("@/lib/integrations/record", () => ({ recordRun: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/contractors/contractor-loans", async (orig) => ({
  ...(await orig<typeof import("@/lib/contractors/contractor-loans")>()),
  todayInPanama: () => "2026-11-19",
}));

import { registerVentasTools } from "./ventas-tools";
import { registerAlmacenTools } from "./almacen-tools";
import { registerPersonalTools } from "./personal-tools";
import type { McpUser } from "./auth";

async function connect(modules: string[], role = "vendedor") {
  const server = new McpServer({ name: "t", version: "1" });
  const user = { id: "u1", email: "a@b.c", clientId: null, profile: { role, modules } } as unknown as McpUser;
  registerVentasTools(server, user);
  registerAlmacenTools(server, user);
  registerPersonalTools(server, user);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const body = (r: unknown) => (r as { content: { text: string }[] }).content[0].text;
const json = (r: unknown) => JSON.parse(body(r));

const line = { id: "l1", itemId: null, name: "Módulo", category: "modulo", finish: "aglomerado", unit: "unidad", shape: "rect", mode: "dir", width: 0, height: 0, pieces: 1, qty: 2, unitPrice: 100, priceOverridden: false, wall: null, posX: null, posY: null, hostLineId: null, golaMl: 0, golaPrice: 0 };
const section = { id: "s1", priceMode: "recipe", directPrice: 0, location: "Cocina", name: "Gabinetes", kind: "Cocina", description: "", qty: 1, utilPct: 50, subMarginPct: 0, wasteSheets: 0, wastePct: 0, wasteSheetPrice: 0, design3d: 0, extraLabor: 0, freight: 0, commissionPct: 0, ccfPct: 0, wallShape: "recta", cornerAt: null, lines: [line] };
const quote = { id: "q1", number: "2617", clientName: "Ana", designerName: "Estudio X", projectName: "", quoteDate: "2026-11-01", deliveryDays: 30, status: "ENVIADA", lang: "es", pdfDetail: "section", terms: null, discountType: "pct", discountValue: 0, itbmsPct: 7, notes: "", sections: [section], opportunityId: null, projectId: null, designerId: null, designerContactId: null, clientId: null, validDays: 15, updatedAt: null, sentOn: "2026-11-02", closedOn: null, followUpOn: null };

beforeEach(() => {
  vi.clearAllMocks();
  cot.getQuote.mockImplementation(async (id: string) => (id === "q1" ? quote : null));
  cot.getQuoteSummaries.mockResolvedValue([{ id: "q1", number: "2617", clientName: "Ana", designerName: "Estudio X", projectName: "", quoteDate: "2026-11-01", status: "ENVIADA", total: 321, updatedAt: "", followUpOn: null, opportunityId: null, projectId: null, designerId: null, clientId: null }]);
  alm.getCatalog.mockResolvedValue([
    { id: "i1", name: "Tornillo", categoryId: "c1", unit: "unidad", allowsDecimals: false, kind: "suministro", notes: null, photoPath: null, active: true, suppliers: [], variants: [{ id: "v1", itemId: "i1", label: "1/2", stockQty: 5, minQty: 10, reorderQty: 100, sortOrder: 0, active: true, unitCostCents: 12, packLabel: null, packQty: null }] },
    { id: "i2", name: "Cola", categoryId: null, unit: "galon", allowsDecimals: true, kind: "suministro", notes: null, photoPath: null, active: true, suppliers: [], variants: [{ id: "v2", itemId: "i2", label: "", stockQty: 8, minQty: 2, reorderQty: null, sortOrder: 0, active: true, unitCostCents: 2500, packLabel: null, packQty: null }] },
  ]);
  ven.getOpportunities.mockResolvedValue([{ id: "o1", title: "Cocina Torre Vista 19C", stage: "enviada", nextFollowUp: null, notes: null, quotes: [] }]);
  ven.getOpportunityNotes.mockResolvedValue([]);
  alm.getCategories.mockResolvedValue([{ id: "c1", name: "Herrajes", sortOrder: 0 }]);
  emp.getPayrollEmployees.mockResolvedValue([{ id: "e1", name: "Luis", position: "Ebanista", categoria: "taller", status: "ACTIVE", startDate: "2024-01-01", endDate: null, phone: "6000", email: null, baseSalaryCents: 90000 }]);
});

describe("MCP · consultas con permisos", () => {
  it("sin el módulo no consulta nada", async () => {
    const client = await connect(["almacen"]);
    const r = await client.callTool({ name: "cotizaciones", arguments: {} });
    expect(r.isError).toBe(true);
    expect(body(r)).toContain("Cotización");
    expect(cot.getQuoteSummaries).not.toHaveBeenCalled();
    const p = await client.callTool({ name: "planilla_quincena", arguments: {} });
    expect(p.isError).toBe(true);
  });

  it("detalle de cotización: precio de venta para todos, costos solo con el permiso de Costos", async () => {
    const seller = await connect(["cotizacion"]);
    const d = json(await seller.callTool({ name: "detalle_cotizacion", arguments: { cotizacion: "2617" } }));
    // 2 × $100 = $200 de costo + 50% de utilidad = $300; + 7% ITBMS = $321.
    expect(d.items[0]).toMatchObject({ precio_unitario: 300, total: 300 });
    expect(d.resumen).toMatchObject({ subtotal: 300, itbms: 21, total: 321 });
    expect(d.items[0].costos).toBeUndefined();
    expect(d.items[0].renglones[0].costo_unitario).toBeUndefined();

    const admin = await connect(["cotizacion", "costos"]);
    const c = json(await admin.callTool({ name: "detalle_cotizacion", arguments: { cotizacion: "q1" } }));
    expect(c.items[0].costos).toMatchObject({ costo_ebony: 200, utilidad: 100 });
    expect(c.items[0].renglones[0].costo_unitario).toBe(100);
  });

  it("inventario: bajo mínimo y costos solo con Compras o Costos del almacén", async () => {
    const client = await connect(["almacen"]);
    const low = json(await client.callTool({ name: "inventario", arguments: { solo_bajo_minimo: true } }));
    expect(low.productos).toEqual([expect.objectContaining({ producto: "Tornillo · 1/2", categoria: "Herrajes", existencia: 5, bajo_minimo: true })]);
    expect(low.productos[0].costo_unitario).toBeUndefined();
    const buyer = await connect(["almacen", "almacen_compras"]);
    const all = json(await buyer.callTool({ name: "inventario", arguments: { buscar: "cola" } }));
    expect(all.productos).toEqual([expect.objectContaining({ producto: "Cola", costo_unitario: 25 })]);
  });

  it("empleados: el sueldo solo con Planilla", async () => {
    const docs = json(await (await connect(["documentos"])).callTool({ name: "empleados", arguments: {} }));
    expect(docs.empleados[0]).toMatchObject({ nombre: "Luis", puesto: "Ebanista" });
    expect(docs.empleados[0].sueldo_mensual).toBeUndefined();
    const admin = json(await (await connect([], "admin")).callTool({ name: "empleados", arguments: {} }));
    expect(admin.empleados[0].sueldo_mensual).toBe(900);
  });
});

describe("MCP · nota de seguimiento", () => {
  it("solo agrega la nota con el sí y el mismo código", async () => {
    const client = await connect(["cotizacion"]);
    const args = { oportunidad: "torre vista", nota: "Llamé a la arquitecta" };
    const prev = json(await client.callTool({ name: "agregar_nota_oportunidad", arguments: args }));
    expect(prev).toMatchObject({ oportunidad: "Cocina Torre Vista 19C", nota: "Llamé a la arquitecta" });
    expect(ven.addOpportunityNote).not.toHaveBeenCalled();
    const bad = await client.callTool({ name: "agregar_nota_oportunidad", arguments: { ...args, nota: "otra", confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(bad.isError).toBe(true);
    await client.callTool({ name: "agregar_nota_oportunidad", arguments: { ...args, confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(ven.addOpportunityNote).toHaveBeenCalledWith("o1", "Llamé a la arquitecta");
  });
});

describe("MCP · salida de almacén", () => {
  beforeEach(() => {
    alm.getInventoryPeople.mockResolvedValue([
      { kind: "contratista", id: "c9", name: "Pedro Pintor", active: true, contractorType: "pintor", photoPath: null },
      { kind: "empleado", id: "e1", name: "Luis Ebanista", active: true, contractorType: null, photoPath: null },
    ]);
    alm.getWarehouseProjects.mockResolvedValue([{ id: "p1", name: "Golden Palace", active: true }]);
    alm.getPendingReturns.mockResolvedValue([]);
    alm.registerIssue.mockResolvedValue("iss1");
  });
  const args = { quien: "pedro", proyecto: "golden", productos: [{ producto: "tornillo", cantidad: 6 }] };

  it("vista previa: existencia que queda, aviso si no alcanza y descuento al pintor; guarda solo con el código", async () => {
    const client = await connect(["almacen"]);
    const prev = json(await client.callTool({ name: "registrar_salida_almacen", arguments: args }));
    expect(prev.productos[0]).toMatchObject({ producto: "Tornillo · 1/2", existencia_antes: 5, existencia_despues: -1 });
    expect(prev.productos[0].aviso).toContain("más de lo que hay");
    expect(prev.sale_mas_de_lo_que_hay).toContain("Tornillo · 1/2: hay 5");
    expect(prev.notas).toContain("Salió más de lo que había en el inventario: Tornillo · 1/2: hay 5");
    expect(prev.descuento_al_pintor).toContain("costo + 10%");
    expect(prev.descuento_al_pintor).not.toContain("$"); // sin permiso de costos no ve el monto
    expect(alm.registerIssue).not.toHaveBeenCalled();
    // Sin el sí explícito a que sale más de lo que hay, no guarda.
    const noOk = await client.callTool({ name: "registrar_salida_almacen", arguments: { ...args, confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(noOk.isError).toBe(true);
    expect(alm.registerIssue).not.toHaveBeenCalled();
    await client.callTool({ name: "registrar_salida_almacen", arguments: { ...args, sale_mas_de_lo_que_hay: true, confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(alm.registerIssue).toHaveBeenCalledWith({
      issuedOn: "2026-11-19",
      recipient: { kind: "contratista", id: "c9" },
      projectId: "p1",
      internalUse: null,
      notes: expect.stringContaining("Salió más de lo que había en el inventario: Tornillo · 1/2: hay 5"),
      lines: [{ variantId: "v1", qty: 6 }],
    });
  });

  it("valida destino, fracciones y el envase pendiente", async () => {
    const client = await connect(["almacen"]);
    expect((await client.callTool({ name: "registrar_salida_almacen", arguments: { ...args, uso_interno: "taller" } })).isError).toBe(true);
    expect((await client.callTool({ name: "registrar_salida_almacen", arguments: { ...args, productos: [{ producto: "tornillo", cantidad: 1.5 }] } })).isError).toBe(true);
    alm.getCatalog.mockResolvedValue([{ id: "i3", name: "Thinner", categoryId: null, unit: "galon", allowsDecimals: false, kind: "devolvible", notes: null, photoPath: null, active: true, suppliers: [], variants: [{ id: "v3", itemId: "i3", label: "", stockQty: 4, minQty: null, reorderQty: null, sortOrder: 0, active: true, unitCostCents: 1000, packLabel: null, packQty: null }] }]);
    alm.getPendingReturns.mockResolvedValue([{ kind: "envase", id: "m7", name: "Thinner", photoPath: null, employeeId: null, contractorId: "c9", person: "Pedro Pintor", since: "2026-11-01", dueOn: null, overdue: false, qty: 1, unit: "galon", project: null }]);
    const thinner = { quien: "pedro", uso_interno: "pintura", productos: [{ producto: "thinner", cantidad: 1 }] };
    const ask = await client.callTool({ name: "registrar_salida_almacen", arguments: thinner });
    expect(ask.isError).toBe(true);
    expect(body(ask)).toContain("envase anterior");
    const prev = json(await client.callTool({ name: "registrar_salida_almacen", arguments: { ...thinner, envase_anterior: "devuelto" } }));
    await client.callTool({ name: "registrar_salida_almacen", arguments: { ...thinner, envase_anterior: "devuelto", confirmar: true, codigo_confirmacion: prev.codigo_confirmacion } });
    expect(alm.returnContainers).toHaveBeenCalledWith(["m7"]);
    expect(alm.registerIssue).toHaveBeenCalledWith(expect.objectContaining({ internalUse: "pintura", projectId: null }));
  });
});
