import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import * as inspections from "@/services/inspections";
import * as taller from "@/services/taller";
import { WORK_ORDER_STATUSES, type WorkOrderKind, type WorkOrderStatus } from "@/types/taller";
import type { McpUser } from "./auth";
import { READ_ONLY, fail, fold, makeReadRegistrar, matches, ok } from "./shared";

/**
 * Consultas de operaciones — solo lectura: Taller (trabajos de CNC y
 * muestras de pintura) e Inspecciones de obra (detalles pendientes). Cada
 * una con el módulo de su pantalla. Sin dinero.
 */

const STATUS_LABEL: Record<WorkOrderStatus, string> = { por_hacer: "Por hacer", en_proceso: "En proceso", listo: "Listo", cancelado: "Cancelado" };

export function registerOperacionesTools(server: McpServer, user: McpUser) {
  const guard = makeReadRegistrar(user);

  server.registerTool(
    "trabajos_taller",
    {
      title: "Trabajos del taller",
      description:
        "Los trabajos del Taller: cortes de CNC y muestras de pintura, con su proyecto, responsable, estado (por hacer, en proceso, listo, cancelado), fecha límite y archivos. Por defecto solo los que no están listos ni cancelados.",
      inputSchema: {
        estado: z.enum(WORK_ORDER_STATUSES as [WorkOrderStatus, ...WorkOrderStatus[]]).optional(),
        todos: z.boolean().optional().describe("true = incluir listos y cancelados"),
        tipo: z.enum(["cnc", "muestra"]).optional(),
        buscar: z.string().optional().describe("Texto en el título, proyecto o responsable"),
      },
      annotations: READ_ONLY,
    },
    guard("trabajos_taller", ["taller"], async (args: { estado?: WorkOrderStatus; todos?: boolean; tipo?: WorkOrderKind; buscar?: string }) => {
      const [orders, people, painters] = await Promise.all([taller.getWorkOrders(args.tipo ? { kind: args.tipo } : {}), taller.getTallerPeople(), taller.getTallerPainters()]);
      const person = new Map(people.map((p) => [p.employeeId, p.name]));
      const painter = new Map(painters.map((p) => [p.contractorId, p.name]));
      const rows = orders
        .filter((o) => (args.estado ? o.status === args.estado : args.todos || (o.status !== "listo" && o.status !== "cancelado")))
        .map((o) => ({ o, who: (o.assigneeId && person.get(o.assigneeId)) || (o.assigneeContractorId && painter.get(o.assigneeContractorId)) || null }))
        .filter(({ o, who }) => matches(args.buscar, o.title, o.projectName, who))
        .map(({ o, who }) => ({
          id: o.id,
          tipo: o.kind === "cnc" ? "Corte CNC" : "Muestra de pintura",
          titulo: o.title,
          proyecto: o.projectName ?? "Interno del taller",
          responsable: who,
          estado: STATUS_LABEL[o.status],
          fecha_limite: o.dueDate,
          empezado: o.startedAt,
          terminado: o.doneAt,
          notas: o.notes,
          archivos: o.files.length,
          muestras: o.kind === "muestra" ? o.samples.map((s) => [s.name, s.officialCode].filter(Boolean).join(" ")) : undefined,
        }));
      return ok({ cantidad: rows.length, trabajos: rows });
    })
  );

  server.registerTool(
    "inspecciones",
    {
      title: "Inspecciones de obra (resumen)",
      description:
        "Resumen de Inspecciones: las obras con visitas (cuántos detalles pendientes y resueltos, última visita) y las visitas más recientes. Para ver los detalles pendientes de una obra, usa pendientes_inspeccion.",
      inputSchema: { recientes: z.number().int().min(1).max(50).optional().describe("Cuántas visitas recientes; por defecto 10") },
      annotations: READ_ONLY,
    },
    guard("inspecciones", ["inspecciones"], async ({ recientes }: { recientes?: number }) => {
      const [overview, projects] = await Promise.all([inspections.getInspectionOverview(recientes ?? 10), inspections.getInspectionProjects()]);
      const name = new Map(projects.map((p) => [p.id, p.name]));
      return ok({
        obras: overview.projects.map((p) => ({ proyecto: name.get(p.projectId) ?? p.projectId, proyecto_id: p.projectId, visitas: p.visits, pendientes: p.pending, resueltos: p.resolved, ultima_visita: p.lastVisit })),
        visitas_recientes: overview.recent.map((v) => ({ proyecto: name.get(v.projectId) ?? v.projectId, fecha: v.visitedOn, por: v.createdByName, detalles: v.items, pendientes: v.pending, notas: v.notes })),
      });
    })
  );

  server.registerTool(
    "pendientes_inspeccion",
    {
      title: "Detalles de inspección de una obra",
      description:
        "Los detalles anotados en las inspecciones de una obra: área, pieza, comentario, tipo (pintura, carpintería, otro), quién lo arregla, si es de Ebony o de un tercero, estado (pendiente o resuelto), la programación (quién y qué día) y la foto. Por defecto solo los pendientes.",
      inputSchema: {
        proyecto: z.string().describe("Nombre (o parte) o id del proyecto"),
        incluir_resueltos: z.boolean().optional(),
      },
      annotations: READ_ONLY,
    },
    guard("pendientes_inspeccion", ["inspecciones"], async ({ proyecto, incluir_resueltos }: { proyecto: string; incluir_resueltos?: boolean }) => {
      const projects = await inspections.getInspectionProjects();
      const q = fold(proyecto);
      const exact = projects.filter((p) => p.id === proyecto || fold(p.name) === q);
      const list = exact.length ? exact : projects.filter((p) => fold(p.name).includes(q));
      if (list.length === 0) return fail(`No encontré un proyecto que coincida con "${proyecto}". Usa inspecciones para ver las obras.`);
      if (list.length > 1) return fail(`Varios proyectos coinciden con "${proyecto}": ${list.map((p) => `${p.name} (id ${p.id})`).join("; ")}. Pregunta cuál.`);
      const p = list[0];
      const visits = await inspections.getProjectInspections(p.id);
      const items = visits.flatMap((v) =>
        v.items
          .filter((it) => incluir_resueltos || it.status === "pendiente")
          .map((it) => ({
            visita: v.visitedOn,
            area: it.area,
            pieza: it.piece,
            comentario: it.comment,
            tipo: it.kind,
            arregla: it.painterName,
            responsable: it.responsible === "tercero" ? `Tercero${it.thirdParty ? `: ${it.thirdParty}` : ""}` : "Ebony",
            estado: it.status,
            resuelto: it.resolvedAt ? `${it.resolvedAt.slice(0, 10)}${it.resolvedByName ? ` por ${it.resolvedByName}` : ""}` : null,
            programado: it.schedule ? `${it.schedule.date}${it.schedule.personName ? ` · ${it.schedule.personName}` : ""}` : null,
            foto: it.photos.find((ph) => ph.kind === "antes")?.url ?? null,
          }))
      );
      return ok({ proyecto: p.name, cliente: p.clientName, ubicacion: p.location, cantidad: items.length, detalles: items });
    })
  );
}
