import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { hasAnyModule } from "@/lib/auth/modules";
import * as almacen from "@/services/almacen";
import type { RequestStatus } from "@/types/almacen";
import type { McpUser } from "./auth";
import { READ_ONLY, makeReadRegistrar, matches, ok, usd } from "./shared";

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
}
