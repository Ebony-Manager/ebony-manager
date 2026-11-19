import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { hasAnyModule } from "@/lib/auth/modules";
import * as almacen from "@/services/almacen";
import { variantName } from "@/lib/almacen/inventory";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { INTERNAL_USES, type InternalUse, type RequestStatus } from "@/types/almacen";
import type { McpUser } from "./auth";
import { CODE_MISMATCH, NEXT_STEP, READ_ONLY, confirmationCode, fail, fold, makeReadRegistrar, matches, ok, usd } from "./shared";

/**
 * Consultas del Almacén — solo lectura, con el módulo Almacén como la
 * pantalla. El costo por unidad solo sale con Compras o Costos del almacén
 * (igual que en la app).
 */

export function registerAlmacenTools(server: McpServer, user: McpUser) {
  const guard = makeReadRegistrar(user);
  const canSeeCosts = () => hasAnyModule(user.profile, ["almacen_costos", "almacen_compras"]);

  server.registerTool(
    "inventario",
    {
      title: "Inventario del almacén",
      description:
        "Productos del almacén con su existencia por variante, el mínimo y el 'pedir hasta', y si está bajo el mínimo. Sirve para '¿cuánto hay de…?' o '¿qué hay que comprar?' (solo_bajo_minimo). El costo por unidad solo aparece con permiso de Compras o Costos del almacén.",
      inputSchema: {
        buscar: z.string().optional().describe("Texto en el nombre del producto, variante o categoría"),
        solo_bajo_minimo: z.boolean().optional().describe("true = solo lo que está en o por debajo del mínimo"),
      },
      annotations: READ_ONLY,
    },
    guard("inventario", ["almacen"], async (args: { buscar?: string; solo_bajo_minimo?: boolean }) => {
      const [items, cats] = await Promise.all([almacen.getCatalog(), almacen.getCategories()]);
      const cat = new Map(cats.map((c) => [c.id, c.name]));
      const costs = canSeeCosts();
      const rows = items
        .filter((it) => it.active)
        .flatMap((it) =>
          it.variants
            .filter((v) => v.active)
            .map((v) => ({ it, v, low: v.minQty != null && v.stockQty <= v.minQty }))
        )
        .filter(({ it, v, low }) => (!args.solo_bajo_minimo || low) && matches(args.buscar, it.name, v.label, it.categoryId ? cat.get(it.categoryId) : null))
        .map(({ it, v, low }) => ({
          producto: v.label ? `${it.name} · ${v.label}` : it.name,
          categoria: it.categoryId ? (cat.get(it.categoryId) ?? null) : null,
          existencia: v.stockQty,
          unidad: it.unit,
          minimo: v.minQty,
          pedir_hasta: v.reorderQty,
          bajo_minimo: low || undefined,
          devolvible: it.kind === "devolvible" || undefined,
          ...(costs ? { costo_unitario: usd(v.unitCostCents) } : {}),
        }));
      return ok({ cantidad: rows.length, productos: rows.slice(0, 400), recortado: rows.length > 400 || undefined });
    })
  );

  server.registerTool(
    "por_devolver",
    {
      title: "Herramientas y envases por devolver",
      description:
        "Lo que la gente tiene prestado del almacén y debe devolver: herramientas y envases, quién lo tiene, desde cuándo, para qué proyecto y si ya está vencido. Útil para '¿quién tiene la engalletadora?' o '¿qué está vencido?'.",
      inputSchema: {
        buscar: z.string().optional().describe("Texto en la herramienta, la persona o el proyecto"),
        solo_vencidos: z.boolean().optional(),
      },
      annotations: READ_ONLY,
    },
    guard("por_devolver", ["almacen"], async (args: { buscar?: string; solo_vencidos?: boolean }) => {
      const rows = (await almacen.getPendingReturns())
        .filter((r) => (!args.solo_vencidos || r.overdue) && matches(args.buscar, r.name, r.person, r.project))
        .map((r) => ({ tipo: r.kind, que: r.name, cantidad: r.kind === "envase" ? `${r.qty} ${r.unit ?? ""}`.trim() : undefined, quien: r.person, proyecto: r.project, desde: r.since, vence: r.dueOn, vencido: r.overdue || undefined }));
      return ok({ cantidad: rows.length, vencidos: rows.filter((r) => r.vencido).length, pendientes: rows });
    })
  );

  server.registerTool(
    "solicitudes_compra",
    {
      title: "Solicitudes de compra",
      description:
        "Lo que se pidió comprar en el almacén (manual o automático por bajo mínimo): descripción, cantidad, proyecto, quién lo pidió, cuándo y el estado (pendiente, pedido, recibido, cancelado). Por defecto las pendientes y pedidas.",
      inputSchema: {
        estado: z.enum(["pendiente", "pedido", "recibido", "cancelado"]).optional(),
        buscar: z.string().optional(),
      },
      annotations: READ_ONLY,
    },
    guard("solicitudes_compra", ["almacen"], async (args: { estado?: RequestStatus; buscar?: string }) => {
      const [reqs, projects] = await Promise.all([almacen.getPurchaseRequests(), almacen.getWarehouseProjects()]);
      const proj = new Map(projects.map((p) => [p.id, p.name]));
      const costs = canSeeCosts();
      const rows = reqs
        .filter((r) => (args.estado ? r.status === args.estado : r.status === "pendiente" || r.status === "pedido"))
        .filter((r) => matches(args.buscar, r.description, r.createdByName, r.projectId ? proj.get(r.projectId) : null))
        .map((r) => ({
          que: r.description,
          cantidad: `${r.qty} ${r.unit ?? ""}`.trim(),
          proyecto: r.projectId ? (proj.get(r.projectId) ?? null) : null,
          motivo: r.reason,
          pedido_por: r.auto ? "Automático (bajo mínimo)" : r.createdByName,
          fecha: r.createdAt.slice(0, 10),
          estado: r.status,
          ...(costs ? { costo_unitario: usd(r.unitCostCents) } : {}),
        }));
      return ok({ cantidad: rows.length, solicitudes: rows });
    })
  );

  const lineSchema = z.object({
    producto: z.string().optional().describe("Nombre del producto (y variante), como aparece en inventario"),
    variante_id: z.string().optional().describe("Id de la variante, si el nombre coincide con varias"),
    cantidad: z.number().positive(),
  });

  server.registerTool(
    "registrar_salida_almacen",
    {
      title: "Registrar salida de material del almacén (con vista previa)",
      description:
        "Registra una entrega de material del almacén a una persona (empleado o contratista), para un proyecto o para uso interno (taller, embalaje, pintura), como 'Salidas' en la app: baja la existencia. A un PINTOR, lo que se lleva se le descuenta en su estado de cuenta a costo + 10%. Si la persona debe un envase de un producto devolvible que se vuelve a llevar, hay que decir si lo devolvió (envase_anterior). SIEMPRE en dos pasos: primero sin `confirmar` (vista previa con cada producto, la existencia que queda y avisos; no guarda nada); solo si la persona aprueba, vuelve a llamar con los MISMOS datos, `confirmar: true` y el código.",
      inputSchema: {
        quien: z.string().describe("Nombre de quien se lo lleva (empleado o contratista activo)"),
        proyecto: z.string().optional().describe("Nombre o id del proyecto al que va el material"),
        uso_interno: z.enum(INTERNAL_USES as [InternalUse, ...InternalUse[]]).optional().describe("Si no va a un proyecto: taller, embalaje o pintura"),
        productos: z.array(lineSchema).min(1).max(50),
        fecha: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
        notas: z.string().optional(),
        envase_anterior: z.enum(["devuelto", "no_devuelto"]).optional().describe("Solo si la vista previa lo pide: si devolvió el envase anterior"),
        confirmar: z.boolean().optional(),
        codigo_confirmacion: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    guard(
      "registrar_salida_almacen",
      ["almacen"],
      async (args: {
        quien: string;
        proyecto?: string;
        uso_interno?: InternalUse;
        productos: z.infer<typeof lineSchema>[];
        fecha?: string;
        notas?: string;
        envase_anterior?: "devuelto" | "no_devuelto";
        confirmar?: boolean;
        codigo_confirmacion?: string;
      }) => {
        const fecha = args.fecha ?? todayInPanama();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("La fecha debe ser YYYY-MM-DD.");
        if (!!args.proyecto === !!args.uso_interno) return fail("Indica a qué va: un proyecto o un uso interno (taller, embalaje o pintura), uno de los dos.");
        const [people, projects, items] = await Promise.all([almacen.getInventoryPeople(), almacen.getWarehouseProjects(), almacen.getCatalog()]);

        const pick = <T,>(list: T[], name: (x: T) => string, id: (x: T) => string, q: string, what: string): T => {
          const f = fold(q);
          const exact = list.filter((x) => id(x) === q || fold(name(x)) === f);
          const hits = exact.length ? exact : list.filter((x) => fold(name(x)).includes(f));
          if (hits.length === 1) return hits[0];
          if (hits.length === 0) throw new Error(`No encontré ${what} que coincida con "${q}".`);
          throw new Error(`Varios coinciden con "${q}": ${hits.slice(0, 10).map(name).join("; ")}. Pregunta cuál.`);
        };
        const person = pick(people.filter((p) => p.active), (p) => p.name, (p) => p.id, args.quien, "una persona activa");
        const project = args.proyecto ? pick(projects.filter((p) => p.active), (p) => p.name, (p) => p.id, args.proyecto, "un proyecto activo") : null;

        const variants = items
          .filter((it) => it.active)
          .flatMap((it) => it.variants.filter((v) => v.active).map((v) => ({ it, v, name: variantName(it.name, v.label) })));
        const lines = args.productos.map((p) => {
          let ref = p.variante_id ? variants.find((x) => x.v.id === p.variante_id) : undefined;
          if (p.variante_id && !ref) throw new Error(`La variante ${p.variante_id} no existe o está inactiva.`);
          if (!ref) {
            if (!p.producto) throw new Error("Cada producto necesita su nombre o variante_id.");
            const f = fold(p.producto);
            const exact = variants.filter((x) => fold(x.name) === f);
            const hits = exact.length ? exact : variants.filter((x) => fold(x.name).includes(f));
            if (hits.length === 0) throw new Error(`No encontré "${p.producto}" en el inventario. Usa la herramienta inventario.`);
            if (hits.length > 1)
              throw new Error(`"${p.producto}" coincide con varios: ${hits.slice(0, 12).map((x) => `${x.name} (variante_id ${x.v.id})`).join("; ")}. Pregunta cuál y usa variante_id.`);
            ref = hits[0];
          }
          if (!ref.it.allowsDecimals && !Number.isInteger(p.cantidad)) throw new Error(`${ref.name} no se entrega en fracciones.`);
          return { ...ref, qty: p.cantidad };
        });
        if (new Set(lines.map((l) => l.v.id)).size !== lines.length) return fail("Un producto aparece dos veces: júntalo en una línea.");

        // Envases que debe de un devolvible que se vuelve a llevar (como la pantalla).
        const pending = await almacen.getPendingReturns({ kind: person.kind, id: person.id });
        const owed = pending.filter((pr) => pr.kind === "envase" && lines.some((l) => l.it.kind === "devolvible" && l.name === pr.name));
        const owedNames = [...new Set(owed.map((o) => o.name))].join(", ");
        if (owed.length > 0 && !args.envase_anterior)
          return fail(`${person.name} no ha devuelto el envase anterior de: ${owedNames}. Pregúntale a la persona si lo devolvió y vuelve a pedir la vista previa con envase_anterior: "devuelto" o "no_devuelto".`);

        const isPainter = person.kind === "contratista" && person.contractorType === "pintor";
        const costs = canSeeCosts();
        const charge = lines.reduce((s, l) => s + (l.v.unitCostCents ?? 0) * l.qty, 0);
        const missingCost = lines.filter((l) => l.v.unitCostCents == null).map((l) => l.name);
        const notes = [args.notas?.trim(), owed.length > 0 && args.envase_anterior === "no_devuelto" ? `Entregado sin devolver el envase anterior de: ${owedNames}.` : ""].filter(Boolean).join("\n") || null;

        const plan = {
          fecha,
          recipient: { kind: person.kind, id: person.id },
          projectId: project?.id ?? null,
          internalUse: args.uso_interno ?? null,
          lines: lines.map((l) => ({ variantId: l.v.id, qty: l.qty })),
          notes,
          containers: owed.length > 0 ? args.envase_anterior : null,
        };
        const code = confirmationCode(user.id, "registrar_salida_almacen", plan);
        if (!args.confirmar) {
          return ok({
            estado: "VISTA PREVIA — no se ha guardado nada",
            fecha,
            se_lo_lleva: `${person.name} (${person.kind === "empleado" ? "empleado" : `contratista${person.contractorType ? ` ${person.contractorType}` : ""}`})`,
            destino: project ? `Proyecto ${project.name}` : `Uso interno: ${args.uso_interno}`,
            productos: lines.map((l) => ({
              producto: l.name,
              cantidad: `${l.qty} ${l.it.unit}`,
              existencia_antes: l.v.stockQty,
              existencia_despues: l.v.stockQty - l.qty,
              aviso: l.qty > l.v.stockQty ? `Solo hay ${l.v.stockQty} en el sistema: la existencia quedará negativa (revisar el conteo).` : undefined,
            })),
            ...(isPainter
              ? {
                  descuento_al_pintor:
                    costs || missingCost.length === 0
                      ? `Se le descuenta en su estado de cuenta a costo + 10%${costs ? `: $${(Math.round(charge * 1.1) / 100).toFixed(2)}` : ""}.`
                      : "Se le descuenta en su estado de cuenta a costo + 10%.",
                  ...(missingCost.length ? { sin_costo_no_se_cobra: missingCost } : {}),
                }
              : {}),
            ...(owed.length ? { envase_anterior: args.envase_anterior === "devuelto" ? `Se marca devuelto el envase de: ${owedNames}.` : `Queda anotado que se entregó sin devolver el envase de: ${owedNames}.` } : {}),
            notas: notes,
            codigo_confirmacion: code,
            siguiente_paso: NEXT_STEP,
          });
        }
        if (args.codigo_confirmacion !== code) return fail(CODE_MISMATCH);
        await almacen.registerIssue({
          issuedOn: fecha,
          recipient: plan.recipient,
          projectId: plan.projectId,
          internalUse: plan.internalUse,
          notes,
          lines: plan.lines,
        });
        // Después de la salida: si la salida falla, el envase no queda marcado como devuelto.
        if (owed.length > 0 && args.envase_anterior === "devuelto") await almacen.returnContainers(owed.map((o) => o.id));
        return ok({ estado: "REGISTRADA", se_lo_lleva: person.name, productos: lines.map((l) => `${l.name} × ${l.qty}`), descontado_al_pintor: isPainter || undefined });
      }
    )
  );
}
