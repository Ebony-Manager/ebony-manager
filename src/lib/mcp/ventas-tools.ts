import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { hasModule } from "@/lib/auth/modules";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { validUntil } from "@/lib/cotizador/owner";
import { quoteTotals, round2, sectionTotals } from "@/lib/cotizador/pricing";
import * as cotizador from "@/services/cotizador";
import * as ventas from "@/services/ventas";
import { OPEN_STAGES, STAGES, type Stage } from "@/types/ventas";
import { QUOTE_STATUSES } from "@/types/cotizador";
import type { McpUser } from "./auth";
import { CODE_MISMATCH, NEXT_STEP, READ_ONLY, confirmationCode, fail, fold, makeReadRegistrar, matches, ok } from "./shared";

/**
 * Consultas de Ventas (Seguimiento) y del Cotizador — solo lectura, con el
 * módulo Cotización como la pantalla. Los costos internos (lo que cuesta
 * cada renglón, la utilidad, la comisión) solo salen con el permiso Costos;
 * sin él se ve lo mismo que el cliente: precios de venta. Montos en dólares
 * (el cotizador ya los guarda así).
 */

const STAGE_LABEL: Record<Stage, string> = {
  por_cotizar: "Por cotizar",
  cotizando: "Cotizando",
  enviada: "Enviada",
  aprobada: "Aprobada",
  perdida: "Perdida",
};

export function registerVentasTools(server: McpServer, user: McpUser) {
  const guard = makeReadRegistrar(user);
  const canSeeCosts = () => hasModule(user.profile, "costos");

  server.registerTool(
    "seguimiento_ventas",
    {
      title: "Seguimiento de ventas (oportunidades)",
      description:
        "Las oportunidades de venta de Seguimiento: qué se está cotizando, para quién (cliente y arquitecto/diseñador), en qué etapa (por cotizar, cotizando, enviada, aprobada, perdida), fechas (recibida, para cuándo, próximo seguimiento) y el monto de su cotización vigente. Por defecto solo las abiertas. Útil para '¿qué cotizaciones tengo pendientes?' o '¿a quién le toca seguimiento?'.",
      inputSchema: {
        etapa: z.enum(STAGES).optional().describe("Filtrar por etapa"),
        todas: z.boolean().optional().describe("true = incluir aprobadas y perdidas (por defecto solo las abiertas)"),
        buscar: z.string().optional().describe("Texto en el título, cliente, arquitecto, edificio o responsable"),
      },
      annotations: READ_ONLY,
    },
    guard("seguimiento_ventas", ["cotizacion"], async (args: { etapa?: Stage; todas?: boolean; buscar?: string }) => {
      const [opps, clients] = await Promise.all([ventas.getOpportunities(), ventas.getClients()]);
      const name = new Map(clients.map((c) => [c.id, c.name]));
      const today = todayInPanama();
      const rows = opps
        .filter((o) => (args.etapa ? o.stage === args.etapa : args.todas || OPEN_STAGES.includes(o.stage)))
        .map((o) => ({ o, cliente: o.clientId ? (name.get(o.clientId) ?? null) : null, arquitecto: o.designerId ? (name.get(o.designerId) ?? null) : null }))
        .filter(({ o, cliente, arquitecto }) => matches(args.buscar, o.title, cliente, arquitecto, o.building, o.location, o.ownerName))
        .map(({ o, cliente, arquitecto }) => {
          const q = o.quotes[0];
          return {
            id: o.id,
            titulo: o.title,
            etapa: STAGE_LABEL[o.stage],
            cliente,
            arquitecto_disenador: arquitecto,
            ubicacion: [o.building, o.unit, o.location].filter(Boolean).join(", ") || null,
            responsable: o.ownerName,
            recibida: o.receivedOn,
            para_cuando: o.dueOn,
            proximo_seguimiento: o.nextFollowUp,
            seguimiento_vencido: o.nextFollowUp != null && o.nextFollowUp < today && OPEN_STAGES.includes(o.stage) ? true : undefined,
            enviada: o.sentOn,
            cerrada: o.closedOn,
            motivo_perdida: o.stage === "perdida" ? [o.lostReason, o.lostNote].filter(Boolean).join(" · ") || null : undefined,
            cotizacion_vigente: q ? { id: q.id, numero: q.number, estado: q.status, total: q.total, fecha: q.quoteDate } : null,
            monto_escrito: o.quotes.length === 0 ? o.amount : undefined,
          };
        });
      const sum = rows.reduce((s, r) => s + (r.cotizacion_vigente?.total ?? r.monto_escrito ?? 0), 0);
      return ok({ hoy: today, cantidad: rows.length, monto_total: round2(sum), oportunidades: rows });
    })
  );

  server.registerTool(
    "cotizaciones",
    {
      title: "Cotizaciones",
      description:
        "Lista de cotizaciones del cotizador: número, cliente, arquitecto/diseñador, proyecto, fecha, estado (BORRADOR, ENVIADA, APROBADA, RECHAZADA), total con ITBMS y fecha de seguimiento. Las más recientes primero. Para ver los ítems de una, usa detalle_cotizacion.",
      inputSchema: {
        estado: z.enum(QUOTE_STATUSES as ["BORRADOR", ...string[]]).optional().describe("Filtrar por estado"),
        buscar: z.string().optional().describe("Texto en el número, cliente, arquitecto o proyecto"),
        desde: z.string().optional().describe("Fecha YYYY-MM-DD: cotizaciones desde esta fecha"),
        limite: z.number().int().min(1).max(300).optional().describe("Máximo; por defecto 50"),
      },
      annotations: READ_ONLY,
    },
    guard("cotizaciones", ["cotizacion"], async (args: { estado?: string; buscar?: string; desde?: string; limite?: number }) => {
      const all = await cotizador.getQuoteSummaries();
      const rows = all
        .filter((q) => (!args.estado || q.status === args.estado) && (!args.desde || q.quoteDate >= args.desde))
        .filter((q) => matches(args.buscar, q.number, q.clientName, q.designerName, q.projectName));
      const shown = rows.slice(0, args.limite ?? 50);
      return ok({
        cantidad: rows.length,
        mostradas: shown.length,
        total_de_las_mostradas: round2(shown.reduce((s, q) => s + q.total, 0)),
        cotizaciones: shown.map((q) => ({
          id: q.id,
          numero: q.number,
          fecha: q.quoteDate,
          estado: q.status,
          cliente: q.clientName || null,
          arquitecto_disenador: q.designerName || null,
          proyecto: q.projectName || null,
          total: q.total,
          seguimiento: q.followUpOn,
        })),
      });
    })
  );

  server.registerTool(
    "detalle_cotizacion",
    {
      title: "Detalle de una cotización",
      description:
        "Una cotización completa: cliente, fechas, validez, estado, cada ítem (ubicación, nombre, cantidad, precio unitario y total de venta) con sus medidas, y el resumen (subtotal, descuento, ITBMS, total). Los costos internos y la utilidad solo aparecen si el usuario tiene el permiso de Costos. Acepta el id o el número de la cotización.",
      inputSchema: { cotizacion: z.string().describe("Id o número de la cotización (ej. 2617)") },
      annotations: READ_ONLY,
    },
    guard("detalle_cotizacion", ["cotizacion"], async ({ cotizacion }: { cotizacion: string }) => {
      let q = await cotizador.getQuote(cotizacion).catch(() => null);
      if (!q) {
        const hit = (await cotizador.getQuoteSummaries()).filter((s) => s.number === cotizacion.trim());
        if (hit.length === 0) return fail(`No encontré la cotización "${cotizacion}". Usa la herramienta cotizaciones para buscarla.`);
        q = await cotizador.getQuote(hit[0].id);
        if (!q) return fail(`No encontré la cotización "${cotizacion}".`);
      }
      const costs = canSeeCosts();
      const t = quoteTotals(q);
      return ok({
        id: q.id,
        numero: q.number,
        estado: q.status,
        fecha: q.quoteDate,
        valida_hasta: validUntil(q.quoteDate, q.validDays),
        entrega_dias: q.deliveryDays,
        cliente: q.clientName || null,
        arquitecto_disenador: q.designerName || null,
        proyecto: q.projectName || null,
        enviada: q.sentOn,
        cerrada: q.closedOn,
        seguimiento: q.followUpOn,
        notas: q.notes || null,
        items: q.sections.map((s) => {
          const st = sectionTotals(s, q);
          return {
            ubicacion: s.location || null,
            nombre: s.name,
            tipo: s.kind,
            descripcion: s.description || null,
            cantidad: st.qty,
            precio_unitario: round2(st.unit),
            ...(st.discount > 0
              ? { precio_sin_descuento: round2(st.gross), descuento: round2(st.discount), descuento_pct: st.discountPct }
              : {}),
            total: round2(st.total),
            renglones: s.priceMode === "direct" ? undefined : s.lines.map((l) => ({
              nombre: l.name,
              acabado: l.finish,
              medidas: l.mode === "med" ? `${l.width} × ${l.height} × ${l.pieces} pzas` : null,
              cantidad: `${l.qty} ${l.unit}`,
              ...(costs ? { costo_unitario: l.unitPrice } : {}),
            })),
            ...(costs && s.priceMode !== "direct"
              ? { costos: { costo_ebony: round2(st.ebony), utilidad: round2(st.util), subcontrato: round2(st.subTotal), extras: round2(st.extras), comision: round2(st.commissionAmount), ccf: round2(st.ccf * st.qty * (st.gross > 0 ? st.total / st.gross : 0)) } }
              : {}),
          };
        }),
        resumen: {
          subtotal: round2(t.gross),
          descuento: round2(t.allDiscounts),
          ...(t.uniformPct !== null ? { descuento_pct: t.uniformPct } : {}),
          neto: round2(t.net),
          itbms: round2(t.tax),
          total: round2(t.total),
          ...(costs ? { comision_arquitecta: round2(t.commission), comision_pct: q.commissionPct, recargo_tarjeta_pct: q.ccfPct } : {}),
        },
        nota: costs ? undefined : "Sin el permiso de Costos solo se muestran precios de venta.",
      });
    })
  );

  /** Una oportunidad por id o por título (parte, sin acentos). */
  async function findOpportunity(query: string) {
    const all = await ventas.getOpportunities();
    const q = fold(query);
    const exact = all.filter((o) => o.id === query || fold(o.title) === q);
    const list = exact.length ? exact : all.filter((o) => fold(o.title).includes(q));
    if (list.length === 0) throw new Error(`No encontré una oportunidad que coincida con "${query}". Usa seguimiento_ventas.`);
    if (list.length > 1) throw new Error(`Varias oportunidades coinciden con "${query}": ${list.slice(0, 10).map((o) => `${o.title} (id ${o.id})`).join("; ")}. Pregunta cuál.`);
    return list[0];
  }

  server.registerTool(
    "notas_oportunidad",
    {
      title: "Notas de seguimiento de una oportunidad",
      description: "La bitácora de seguimiento de una oportunidad de venta (las notas que se han ido anotando, la más nueva primero), con quién y cuándo.",
      inputSchema: { oportunidad: z.string().describe("Título (o parte) o id de la oportunidad") },
      annotations: READ_ONLY,
    },
    guard("notas_oportunidad", ["cotizacion"], async ({ oportunidad }: { oportunidad: string }) => {
      const o = await findOpportunity(oportunidad);
      const notes = await ventas.getOpportunityNotes(o.id);
      return ok({
        oportunidad: o.title,
        etapa: STAGE_LABEL[o.stage],
        proximo_seguimiento: o.nextFollowUp,
        notas_generales: o.notes,
        bitacora: notes.map((n) => ({ fecha: n.createdAt.slice(0, 10), por: n.createdByName, nota: n.body })),
      });
    })
  );

  server.registerTool(
    "agregar_nota_oportunidad",
    {
      title: "Agregar nota de seguimiento a una oportunidad (con vista previa)",
      description:
        "Anota en la bitácora de seguimiento de una oportunidad de venta lo que pasó (ej. 'Llamé a la arquitecta, revisa la cotización el lunes'). Solo agrega una nota: no cambia la etapa, montos ni fechas. SIEMPRE en dos pasos: primero sin `confirmar` (vista previa y codigo_confirmacion); solo si la persona aprueba, vuelve a llamar con los MISMOS datos, `confirmar: true` y el código.",
      inputSchema: {
        oportunidad: z.string().describe("Título (o parte) o id de la oportunidad"),
        nota: z.string().min(1).max(2000).describe("El texto de la nota, tal como lo dijo la persona"),
        confirmar: z.boolean().optional(),
        codigo_confirmacion: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    guard("agregar_nota_oportunidad", ["cotizacion"], async (args: { oportunidad: string; nota: string; confirmar?: boolean; codigo_confirmacion?: string }) => {
      const o = await findOpportunity(args.oportunidad);
      const body = args.nota.trim();
      if (!body) return fail("La nota está vacía.");
      const plan = { opportunityId: o.id, body };
      const code = confirmationCode(user.id, "agregar_nota_oportunidad", plan);
      if (!args.confirmar) {
        return ok({ estado: "VISTA PREVIA — no se ha guardado nada", oportunidad: o.title, etapa: STAGE_LABEL[o.stage], nota: body, codigo_confirmacion: code, siguiente_paso: NEXT_STEP });
      }
      if (args.codigo_confirmacion !== code) return fail(CODE_MISMATCH);
      await ventas.addOpportunityNote(o.id, body);
      return ok({ estado: "ANOTADA", oportunidad: o.title, nota: body });
    })
  );
}
