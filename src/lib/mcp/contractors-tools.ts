import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { hasModule } from "@/lib/auth/modules";
import { isScheduled, todayInPanama } from "@/lib/contractors/contractor-loans";
import { contractorBalanceCents, withRunningBalance } from "@/lib/contractors/contractor-ledger";
import { contractPayableCents, contractPendingCents, contractProgressPct, sortContracts } from "@/lib/contractors/contracts";
import * as contractors from "@/services/contractors";
import type { Contractor, ContractorLedgerEntry } from "@/types/contractors";
import { CONTRACTORS_GUIDE } from "./contractors-guide";
import { recordRun } from "@/lib/integrations/record";
import { createClient } from "@/lib/supabase/server";
import type { McpUser } from "./auth";

/**
 * Herramientas de CONSULTA del módulo de Contratistas para la IA. Usan los
 * mismos servicios que la app con el token del usuario (la RLS aplica) y
 * además exigen el módulo `contratistas`. Montos en dólares.
 */

const usd = (cents: number) => Math.round(cents) / 100;
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }] });
const fail = (msg: string): Result => ({ content: [{ type: "text", text: msg }], isError: true });

/** Un contratista por id o por nombre (parte del nombre, sin acentos). */
async function findContractor(query: string): Promise<{ one: Contractor } | { many: Contractor[] } | { none: true }> {
  const all = await contractors.getContractors();
  const byId = all.find((c) => c.id === query);
  if (byId) return { one: byId };
  const q = fold(query);
  const exact = all.filter((c) => fold(c.name) === q);
  if (exact.length === 1) return { one: exact[0] };
  const matches = all.filter((c) => fold(c.name).includes(q));
  if (matches.length === 1) return { one: matches[0] };
  if (matches.length === 0) return { none: true };
  return { many: matches };
}

function pickContractor(r: Awaited<ReturnType<typeof findContractor>>, query: string): Contractor | Result {
  if ("one" in r) return r.one;
  if ("none" in r) return fail(`No encontré ningún contratista que coincida con "${query}". Usa listar_contratistas para ver los nombres.`);
  return fail(`Hay varios contratistas que coinciden con "${query}": ${r.many.map((c) => `${c.name} (id ${c.id})`).join("; ")}. Pregunta cuál es o usa su id.`);
}

const entryOut = (e: ContractorLedgerEntry & { balanceAfterCents?: number }) => ({
  fecha: e.entryDate,
  categoria: e.category,
  efecto: e.ebonyAbsorbsMaterial ? "no mueve el saldo (Ebony asume el material)" : e.direction === "a_favor" ? "sube el saldo" : "baja el saldo",
  monto: usd(e.amountCents),
  ...(e.balanceAfterCents !== undefined ? { saldo_despues: usd(e.balanceAfterCents) } : {}),
  contrato: e.contractName,
  proyecto: e.projectName,
  descripcion: [e.description, e.itemsSummary].filter(Boolean).join(" · ") || null,
  notas: e.notes,
  ...(e.mt2 != null ? { m2: e.mt2, costo_por_m2: e.costPerMt2Cents != null ? usd(e.costPerMt2Cents) : null } : {}),
  cuota_de_prestamo: e.loanId ? true : undefined,
});

export function registerContractorTools(server: McpServer, user: McpUser) {
  const allowed = () => hasModule(user.profile, "contratistas");
  const denied = () => fail("Tu usuario no tiene el permiso de Contratistas en Ebony Manager.");
  // Cada consulta queda anotada en Settings → Conexiones (quién y qué).
  const note = async (tool: string, okRun: boolean, detail?: string) =>
    recordRun(await createClient(), null, "mcp", okRun, `${user.email ?? user.id} · ${tool}${detail ? `: ${detail}` : ""}`);
  const guard = (tool: string, fn: () => Promise<Result>) => async (): Promise<Result> => {
    if (!allowed()) {
      await note(tool, false, "sin permiso de Contratistas");
      return denied();
    }
    try {
      const res = await fn();
      await note(tool, !res.isError);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await note(tool, false, msg);
      return fail(`Error al consultar: ${msg}`);
    }
  };

  server.registerTool(
    "guia_contratistas",
    {
      title: "Guía de Contratistas",
      description:
        "Explica cómo funciona el módulo de Contratistas de Ebony Manager: estado de cuenta y saldo, contratos, abonos, lo que está 'a cuenta', cierre de quincena, préstamos en cuotas y retención de garantía de pintores. Léela antes de explicar saldos o contratos.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => ({ content: [{ type: "text", text: CONTRACTORS_GUIDE }] })
  );

  server.registerTool(
    "listar_contratistas",
    {
      title: "Listar contratistas",
      description: "Contratistas con su tipo (ebanista/pintor), estado, saldo de hoy (positivo = Ebony le debe) y contratos activos. Filtra por nombre si se da `buscar`.",
      inputSchema: {
        buscar: z.string().optional().describe("Parte del nombre"),
        incluir_inactivos: z.boolean().optional().describe("Incluir contratistas inactivos (por defecto no)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ buscar, incluir_inactivos }) =>
      guard("listar_contratistas", async () => {
        const [list, dash, contracts] = await Promise.all([contractors.getContractors(), contractors.getContractorsDashboardInput(), contractors.getContracts()]);
        const q = buscar ? fold(buscar) : "";
        const rows = list
          .filter((c) => (incluir_inactivos ? true : c.status === "ACTIVE"))
          .filter((c) => !q || fold(c.name).includes(q))
          .map((c) => {
            const mine = dash.entries.filter((e) => e.contractorId === c.id);
            const loans = dash.loans.filter((l) => l.contractorId === c.id && l.status === "active");
            return {
              id: c.id,
              nombre: c.name,
              tipo: c.contractorType,
              estado: c.status === "ACTIVE" ? "activo" : "inactivo",
              saldo_hoy: usd(contractorBalanceCents(mine)),
              contratos_activos: contracts.filter((k) => k.contractorId === c.id && k.status === "ACTIVE").length,
              prestamos_pendientes: usd(loans.reduce((s, l) => s + l.pendingCents, 0)),
            };
          });
        return ok({ hoy: todayInPanama(), nota: "saldo_hoy positivo = Ebony le debe al contratista; negativo = el contratista le debe a Ebony.", contratistas: rows });
      })()
  );

  server.registerTool(
    "estado_de_cuenta",
    {
      title: "Estado de cuenta de un contratista",
      description:
        "Movimientos del estado de cuenta de un contratista con el saldo después de cada uno (hasta hoy), el saldo actual y las cuotas programadas a futuro (que aún no cuentan). Acepta el nombre o el id.",
      inputSchema: {
        contratista: z.string().describe("Nombre (o parte) o id del contratista"),
        desde: z.string().optional().describe("Fecha YYYY-MM-DD: mostrar movimientos desde esta fecha (el saldo sigue contando todo)"),
        hasta: z.string().optional().describe("Fecha YYYY-MM-DD: mostrar hasta esta fecha"),
        limite: z.number().int().min(1).max(500).optional().describe("Máximo de movimientos (los más recientes); por defecto 100"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ contratista, desde, hasta, limite }) =>
      guard("estado_de_cuenta", async () => {
        const c = pickContractor(await findContractor(contratista), contratista);
        if ("content" in c) return c;
        const today = todayInPanama();
        const all = await contractors.getContractorLedger(c.id);
        const due = all.filter((e) => !isScheduled(e, today));
        const scheduled = all.filter((e) => isScheduled(e, today));
        const rows = withRunningBalance(due).filter((e) => (!desde || e.entryDate >= desde) && (!hasta || e.entryDate <= hasta));
        const shown = rows.slice(-(limite ?? 100));
        return ok({
          contratista: { id: c.id, nombre: c.name, tipo: c.contractorType, estado: c.status === "ACTIVE" ? "activo" : "inactivo" },
          hoy: today,
          saldo_hoy: usd(contractorBalanceCents(due)),
          nota: "saldo positivo = Ebony le debe; negativo = el contratista debe.",
          movimientos_mostrados: shown.length,
          movimientos_totales: rows.length,
          movimientos: shown.map(entryOut),
          cuotas_programadas_a_futuro: scheduled.map((e) => ({ fecha: e.entryDate, categoria: e.category, monto: usd(e.amountCents), descripcion: e.description })),
        });
      })()
  );

  server.registerTool(
    "contratos",
    {
      title: "Contratos",
      description:
        "Contratos de un contratista o de un proyecto con su valor, lo abonado, lo que falta, lo retenido (pintores) y lo que se puede pagar hoy. Sin filtros: todos los activos.",
      inputSchema: {
        contratista: z.string().optional().describe("Nombre o id del contratista"),
        proyecto: z.string().optional().describe("Nombre (o parte) o id del proyecto"),
        incluir_terminados: z.boolean().optional().describe("Incluir contratos terminados (por defecto solo activos, salvo que se filtre por contratista)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ contratista, proyecto, incluir_terminados }) =>
      guard("contratos", async () => {
        let contractorId: string | undefined;
        if (contratista) {
          const c = pickContractor(await findContractor(contratista), contratista);
          if ("content" in c) return c;
          contractorId = c.id;
        }
        let projectId: string | undefined;
        if (proyecto) {
          const projects = await contractors.getProjects();
          const q = fold(proyecto);
          const match = projects.filter((p) => p.id === proyecto || fold(p.name).includes(q));
          if (match.length === 0) return fail(`No encontré un proyecto que coincida con "${proyecto}".`);
          if (match.length > 1 && !match.some((p) => fold(p.name) === q))
            return fail(`Varios proyectos coinciden con "${proyecto}": ${match.map((p) => `${p.name} (id ${p.id})`).join("; ")}.`);
          projectId = (match.find((p) => fold(p.name) === q) ?? match[0]).id;
        }
        const showDone = incluir_terminados ?? !!contractorId;
        const list = sortContracts(await contractors.getContracts({ contractorId, projectId })).filter((k) => showDone || k.status === "ACTIVE");
        return ok({
          contratos: list.map((k) => ({
            id: k.id,
            nombre: k.name,
            contratista: k.contractorName,
            proyecto: k.projectName,
            fecha: k.contractDate,
            estado: k.status === "ACTIVE" ? "activo" : "terminado",
            valor: usd(k.valueCents),
            abonado: usd(k.allocatedCents),
            falta_por_pagar: usd(contractPendingCents(k)),
            retenido_garantia: usd(k.retentionCents),
            se_puede_pagar_hoy: usd(contractPayableCents(k)),
            avance_de_pago_pct: contractProgressPct(k),
            notas: k.notes,
          })),
        });
      })()
  );

  server.registerTool(
    "detalle_contrato",
    {
      title: "Detalle de un contrato",
      description: "Un contrato con los movimientos que forman su valor (trabajo con piezas y medidas, extras, bonos, ajustes) y los abonos que ha recibido (de qué pago, cuota o descuento salieron).",
      inputSchema: { contrato_id: z.string().describe("Id del contrato (sale de la herramienta contratos)") },
      annotations: { readOnlyHint: true },
    },
    async ({ contrato_id }) =>
      guard("detalle_contrato", async () => {
        const all = await contractors.getContracts();
        const k = all.find((x) => x.id === contrato_id);
        if (!k) return fail("No encontré ese contrato (o no tienes acceso). Usa la herramienta contratos para ver los ids.");
        const [work, allocations, ledger] = await Promise.all([
          contractors.getContractWork(k.id),
          contractors.getContractorAllocations(k.contractorId),
          contractors.getContractorLedger(k.contractorId),
        ]);
        const byId = new Map(ledger.map((e) => [e.id, e]));
        const mine = allocations.filter((a) => a.contractId === k.id);
        return ok({
          contrato: {
            id: k.id,
            nombre: k.name,
            contratista: k.contractorName,
            proyecto: k.projectName,
            fecha: k.contractDate,
            estado: k.status === "ACTIVE" ? "activo" : "terminado",
            valor: usd(k.valueCents),
            abonado: usd(k.allocatedCents),
            falta_por_pagar: usd(contractPendingCents(k)),
            retenido_garantia: usd(k.retentionCents),
            se_puede_pagar_hoy: usd(contractPayableCents(k)),
            notas: k.notes,
          },
          movimientos_del_valor: work.map(entryOut),
          abonos_recibidos: mine.map((a) => {
            const src = byId.get(a.sourceEntryId);
            return { monto: usd(a.amountCents), de: src ? { fecha: src.entryDate, categoria: src.category, monto_total: usd(src.amountCents), descripcion: src.description } : null };
          }),
        });
      })()
  );

  server.registerTool(
    "prestamos_contratista",
    {
      title: "Préstamos y descuentos en cuotas",
      description: "Préstamos, adelantos y descuentos en cuotas de un contratista: lo prestado, interés, lo ya descontado, lo pendiente y la próxima cuota.",
      inputSchema: { contratista: z.string().describe("Nombre o id del contratista") },
      annotations: { readOnlyHint: true },
    },
    async ({ contratista }) =>
      guard("prestamos_contratista", async () => {
        const c = pickContractor(await findContractor(contratista), contratista);
        if ("content" in c) return c;
        const loans = await contractors.getContractorLoans(c.id);
        return ok({
          contratista: c.name,
          prestamos: loans.map((l) => ({
            tipo: l.category,
            fecha: l.requestDate,
            estado: l.status === "active" ? "activo" : "cancelado",
            prestado: usd(l.principalCents),
            interes: usd(l.interestCents),
            cuotas: l.installmentCount,
            cuotas_descontadas: l.paidCount,
            descontado: usd(l.paidCents),
            pendiente: usd(l.pendingCents),
            proxima_cuota: l.next ? { fecha: l.next.date, monto: usd(l.next.amountCents) } : null,
            notas: l.notes,
          })),
        });
      })()
  );

  server.registerTool(
    "tarifas_mano_de_obra",
    {
      title: "Tarifas de mano de obra",
      description: "Tarifas vigentes por tipo de contratista (ebanista/pintor), fase (armado/instalación) y unidad (m², ML, unidad). Son las que se usan para valorar los trabajos de un contrato.",
      inputSchema: { tipo: z.enum(["ebanista", "pintor"]).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ tipo }) =>
      guard("tarifas_mano_de_obra", async () => {
        const rates = (await contractors.getLaborRates()).filter((r) => r.activo && (!tipo || r.contractorType === tipo));
        return ok({
          tarifas: rates.map((r) => ({ tipo: r.contractorType, fase: r.fase, unidad: r.unidad, descripcion: r.descripcion, precio: usd(r.precioCents) })),
        });
      })()
  );

  server.registerTool(
    "proyectos",
    {
      title: "Proyectos",
      description: "Proyectos (obras) con su estado y cliente, para ubicar contratos. Filtra por nombre con `buscar`.",
      inputSchema: { buscar: z.string().optional(), incluir_terminados: z.boolean().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ buscar, incluir_terminados }) =>
      guard("proyectos", async () => {
        const q = buscar ? fold(buscar) : "";
        const list = (await contractors.getProjects()).filter((p) => (incluir_terminados || p.status === "ACTIVE") && (!q || fold(p.name).includes(q)));
        return ok({ proyectos: list.map((p) => ({ id: p.id, nombre: p.name, estado: p.status === "ACTIVE" ? "activo" : "terminado", cliente: p.clientName, ubicacion: p.location })) });
      })()
  );
}
