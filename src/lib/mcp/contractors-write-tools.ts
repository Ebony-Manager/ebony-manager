import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { hasModule } from "@/lib/auth/modules";
import {
  CONTRACTOR_LOAN_CATEGORIES,
  CONTRACTOR_LOAN_LABEL,
  isScheduled,
  planContractorLoan,
  todayInPanama,
} from "@/lib/contractors/contractor-loans";
import { isSingleInstallment, type LoanInterestInput } from "@/lib/planilla/payroll-loans";
import {
  ALLOCATABLE_CATEGORIES,
  NEW_ENTRY_CATEGORIES,
  VALUE_CATEGORIES,
  contractRequiredForNew,
  contractorBalanceCents,
  directionForCategory,
  isMaterialCategory,
  lineAmountCents,
} from "@/lib/contractors/contractor-ledger";
import { contractPayableCents, contractPendingCents, paymentPreview, unallocatedSources } from "@/lib/contractors/contracts";
import { recordRun } from "@/lib/integrations/record";
import { createClient } from "@/lib/supabase/server";
import * as contractors from "@/services/contractors";
import type { ContractorLedgerCategory, LaborRate } from "@/types/contractors";
import type { McpUser } from "./auth";

/**
 * Herramientas que CAMBIAN datos de Contratistas, siempre en dos pasos:
 *  1. Sin `confirmar`: valida, calcula y devuelve la VISTA PREVIA (nada se
 *     guarda) con un `codigo_confirmacion`.
 *  2. Con `confirmar: true` y ese mismo código (datos idénticos): guarda.
 * El código sale de los datos exactos de la vista previa: si la IA cambia
 * algo entre medio, el código no coincide y no se guarda nada. Los mismos
 * servicios de la app con el token de la persona (RLS) y el módulo de
 * Contratistas. Montos en dólares.
 */

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (data: unknown): Result => ({ content: [{ type: "text", text: JSON.stringify(data, null, 1) }] });
const fail = (msg: string): Result => ({ content: [{ type: "text", text: msg }], isError: true });
const usd = (cents: number) => Math.round(cents) / 100;
const cents = (dollars: number) => Math.round(dollars * 100);
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function confirmationCode(userId: string, kind: string, plan: unknown): string {
  return createHash("sha256").update(`${userId}|${kind}|${JSON.stringify(plan)}`).digest("hex").slice(0, 10);
}

async function resolveContractor(query: string) {
  const all = await contractors.getContractors();
  const q = fold(query);
  const hits = all.filter((c) => c.id === query || fold(c.name) === q);
  const list = hits.length ? hits : all.filter((c) => fold(c.name).includes(q));
  if (list.length === 1) return list[0];
  if (list.length === 0) throw new Error(`No encontré un contratista que coincida con "${query}".`);
  throw new Error(`Varios contratistas coinciden con "${query}": ${list.map((c) => `${c.name} (id ${c.id})`).join("; ")}. Pregunta cuál.`);
}

async function resolveProject(query: string) {
  const all = await contractors.getProjects();
  const q = fold(query);
  const hits = all.filter((p) => p.id === query || fold(p.name) === q);
  const list = hits.length ? hits : all.filter((p) => fold(p.name).includes(q));
  if (list.length === 1) return list[0];
  if (list.length === 0) throw new Error(`No encontré un proyecto que coincida con "${query}". Usa la herramienta proyectos.`);
  throw new Error(`Varios proyectos coinciden con "${query}": ${list.map((p) => `${p.name} (id ${p.id})`).join("; ")}. Pregunta cuál.`);
}

/** La tarifa de una pieza: por id, o por descripción (+ fase) entre las del tipo del contratista. */
function resolveRate(rates: LaborRate[], piece: { tarifa_id?: string; descripcion?: string; fase?: string }): LaborRate {
  if (piece.tarifa_id) {
    const r = rates.find((x) => x.id === piece.tarifa_id);
    if (!r) throw new Error(`La tarifa ${piece.tarifa_id} no existe, está inactiva o no es del tipo de este contratista.`);
    return r;
  }
  const d = fold(piece.descripcion ?? "");
  if (!d) throw new Error("Cada pieza necesita tarifa_id o la descripción de la tarifa.");
  let list = rates.filter((r) => fold(r.descripcion) === d);
  if (list.length === 0) list = rates.filter((r) => fold(r.descripcion).includes(d));
  if (piece.fase) list = list.filter((r) => r.fase === piece.fase);
  if (list.length === 1) return list[0];
  if (list.length === 0) throw new Error(`No hay una tarifa que coincida con "${piece.descripcion}". Usa tarifas_mano_de_obra para ver las disponibles.`);
  throw new Error(
    `"${piece.descripcion}" coincide con varias tarifas: ${list.map((r) => `${r.descripcion} [${r.fase ?? "-"}, ${r.unidad}] (id ${r.id})`).join("; ")}. Usa tarifa_id.`
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  trabajo: "Trabajo",
  extra: "Extra",
  bono: "Bono",
  material: "Material",
  gasto_operativo: "Gasto operativo",
  ajuste: "Ajuste",
};

const pieceSchema = z.object({
  tarifa_id: z.string().optional().describe("Id de la tarifa (de tarifas_mano_de_obra). Preferido."),
  descripcion: z.string().optional().describe("Si no hay tarifa_id: la descripción de la tarifa tal como aparece en tarifas_mano_de_obra"),
  fase: z.enum(["armado", "instalacion"]).optional().describe("Ebanistas: armado o instalación, para distinguir tarifas iguales"),
  cantidad: z.number().positive().describe("Cantidad en la unidad de la tarifa (m², ML o unidades), sacada de las medidas"),
  detalle: z.string().optional().describe("La pieza concreta (ej. 'Closet principal 2.40 × 2.60')"),
});

export function registerContractorWriteTools(server: McpServer, user: McpUser) {
  const allowed = () => hasModule(user.profile, "contratistas");
  const note = async (tool: string, okRun: boolean, detail?: string) =>
    recordRun(await createClient(), null, "mcp", okRun, `${user.email ?? user.id} · ${tool}${detail ? `: ${detail}` : ""}`);
  const run = async (tool: string, fn: () => Promise<Result>): Promise<Result> => {
    if (!allowed()) {
      await note(tool, false, "sin permiso de Contratistas");
      return fail("Tu usuario no tiene el permiso de Contratistas en Ebony Manager.");
    }
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await note(tool, false, msg);
      return fail(msg);
    }
  };

  server.registerTool(
    "crear_contrato",
    {
      title: "Crear contrato (con vista previa)",
      description:
        "Crea un contrato para un contratista en un proyecto, valorado con piezas × tarifas de mano de obra (o un monto fijo). Sirve para pasar a la app las medidas de un plano o una foto: saca las cantidades (m², ML, unidades) y elige la tarifa de cada pieza con tarifas_mano_de_obra. SIEMPRE en dos pasos: primero sin `confirmar` (devuelve la vista previa y un codigo_confirmacion; no guarda nada); muéstrale la vista previa a la persona y, solo si dice que sí, vuelve a llamar con los MISMOS datos, `confirmar: true` y ese código.",
      inputSchema: {
        contratista: z.string().describe("Nombre o id del contratista"),
        proyecto: z.string().describe("Nombre o id del proyecto (obra)"),
        nombre: z.string().min(1).describe("Nombre del contrato (ej. 'Cocina y closets')"),
        fecha: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
        piezas: z.array(pieceSchema).optional().describe("Las piezas con su tarifa y cantidad"),
        monto_fijo: z.number().positive().optional().describe("Si no se valora por piezas: el monto acordado en dólares"),
        ya_abonado: z.number().positive().optional().describe("Lo que ya se le había pagado de este trabajo antes de registrarlo"),
        notas: z.string().optional(),
        confirmar: z.boolean().optional().describe("true solo después de que la persona aprobó la vista previa"),
        codigo_confirmacion: z.string().optional().describe("El código que devolvió la vista previa"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      run("crear_contrato", async () => {
        const fecha = args.fecha ?? todayInPanama();
        if (!ISO.test(fecha)) return fail("La fecha debe ser YYYY-MM-DD.");
        const hasPieces = (args.piezas?.length ?? 0) > 0;
        if (hasPieces === (args.monto_fijo !== undefined)) return fail("Indica las piezas o un monto_fijo (uno de los dos).");
        const c = await resolveContractor(args.contratista);
        if (c.status !== "ACTIVE") return fail(`${c.name} está inactivo: actívalo en la app antes de crearle un contrato.`);
        const p = await resolveProject(args.proyecto);
        const rates = (await contractors.getLaborRates()).filter((r) => r.activo && r.contractorType === c.contractorType);
        const items = (args.piezas ?? []).map((piece) => {
          const r = resolveRate(rates, piece);
          const subtotal = Math.round(piece.cantidad * r.precioCents);
          return {
            laborRateId: r.id,
            descripcion: r.descripcion,
            detalle: piece.detalle?.trim() || null,
            fase: r.fase,
            unidad: r.unidad,
            precioUnitarioCents: r.precioCents,
            cantidad: piece.cantidad,
            subtotalCents: subtotal,
          };
        });
        const amount = hasPieces ? items.reduce((s, it) => s + it.subtotalCents, 0) : cents(args.monto_fijo!);
        if (amount <= 0) return fail("El contrato quedaría en $0.");
        const prepaid = args.ya_abonado ? cents(args.ya_abonado) : 0;
        if (prepaid > amount) return fail("Lo ya abonado no puede ser mayor que el valor del contrato.");
        const plan = { contractorId: c.id, projectId: p.id, nombre: args.nombre.trim(), fecha, items, amount, prepaid, notas: args.notas?.trim() || null };
        const code = confirmationCode(user.id, "crear_contrato", plan);

        if (!args.confirmar) {
          return ok({
            estado: "VISTA PREVIA — no se ha guardado nada",
            contratista: `${c.name} (${c.contractorType})`,
            proyecto: p.name,
            contrato: plan.nombre,
            fecha,
            piezas: items.map((it) => ({
              tarifa: `${it.descripcion}${it.fase ? ` · ${it.fase}` : ""}`,
              detalle: it.detalle,
              cantidad: `${it.cantidad} ${it.unidad}`,
              precio_unitario: usd(it.precioUnitarioCents),
              subtotal: usd(it.subtotalCents),
            })),
            valor_del_contrato: usd(amount),
            ya_abonado: prepaid ? usd(prepaid) : 0,
            efecto: `El saldo de ${c.name} sube $${usd(amount - prepaid).toFixed(2)} (lo que Ebony le deberá por este contrato).`,
            notas: plan.notas,
            codigo_confirmacion: code,
            siguiente_paso: "Muestra esto a la persona. Si lo aprueba, llama de nuevo con los mismos datos, confirmar: true y este codigo_confirmacion.",
          });
        }
        if (args.codigo_confirmacion !== code)
          return fail("El código no coincide con estos datos (cambió algo desde la vista previa). Vuelve a pedir la vista previa y confírmala.");
        const id = await contractors.createContract({
          contractorId: c.id,
          projectId: p.id,
          name: plan.nombre,
          contractDate: fecha,
          notes: plan.notas,
          work: { amountCents: amount, mt2: null, costPerMt2Cents: null, items },
          prepaidCents: prepaid || undefined,
        });
        await note("crear_contrato", true, `${c.name} · ${plan.nombre} · $${usd(amount).toFixed(2)}`);
        return ok({ estado: "CREADO", contrato_id: id, contratista: c.name, proyecto: p.name, contrato: plan.nombre, valor: usd(amount) });
      })
  );

  server.registerTool(
    "registrar_abono",
    {
      title: "Registrar abono a un contratista (con vista previa)",
      description:
        "Registra un pago a un contratista repartido entre sus contratos (y/o a lo acreditado sin contrato), como 'Registrar pago' en la app: primero se descuenta lo que está a cuenta (cuotas, adelantos, material…) y el resto es lo que se entrega en efectivo. SIEMPRE en dos pasos: primero sin `confirmar` (vista previa con el efectivo a entregar y codigo_confirmacion; no guarda nada); solo si la persona aprueba, vuelve a llamar con los MISMOS datos, `confirmar: true` y el código.",
      inputSchema: {
        contratista: z.string().describe("Nombre o id del contratista"),
        abonos: z
          .array(z.object({ contrato_id: z.string(), monto: z.number().positive().describe("Dólares a abonar a ese contrato") }))
          .optional()
          .describe("Cuánto se abona a cada contrato (ids de la herramienta contratos)"),
        sin_contrato: z.number().positive().optional().describe("Dólares a abonar a lo acreditado sin contrato"),
        fecha: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
        notas: z.string().optional(),
        confirmar: z.boolean().optional(),
        codigo_confirmacion: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      run("registrar_abono", async () => {
        const fecha = args.fecha ?? todayInPanama();
        if (!ISO.test(fecha)) return fail("La fecha debe ser YYYY-MM-DD.");
        const c = await resolveContractor(args.contratista);
        const lines = (args.abonos ?? []).map((a) => ({ contractId: a.contrato_id, amountCents: cents(a.monto) }));
        const loose = args.sin_contrato ? cents(args.sin_contrato) : 0;
        if (lines.length === 0 && loose === 0) return fail("Indica a qué contratos (o sin contrato) y cuánto.");
        if (new Set(lines.map((l) => l.contractId)).size !== lines.length) return fail("Un contrato aparece dos veces: júntalo en una sola línea.");

        const [contracts, ledger, allocations] = await Promise.all([
          contractors.getContracts({ contractorId: c.id }),
          contractors.getContractorLedger(c.id),
          contractors.getContractorAllocations(c.id),
        ]);
        const rows = lines.map((l) => {
          const k = contracts.find((x) => x.id === l.contractId);
          if (!k) throw new Error(`El contrato ${l.contractId} no es de ${c.name}. Usa la herramienta contratos.`);
          const payable = contractPayableCents(k);
          if (l.amountCents > payable)
            throw new Error(
              `Al contrato "${k.name}" se le pueden abonar hasta $${usd(payable).toFixed(2)} hoy${k.retentionCents > 0 ? ` (tiene $${usd(k.retentionCents).toFixed(2)} retenidos hasta terminar el proyecto)` : ""}.`
            );
          return { k, amount: l.amountCents };
        });
        const total = lines.reduce((s, l) => s + l.amountCents, 0) + loose;
        const onAccount = unallocatedSources(ledger, allocations, fecha).reduce((s, r) => s + r.remainingCents, 0);
        const preview = paymentPreview(total, onAccount);
        const plan = { contractorId: c.id, fecha, lines, loose, notas: args.notas?.trim() || null };
        const code = confirmationCode(user.id, "registrar_abono", plan);

        if (!args.confirmar) {
          return ok({
            estado: "VISTA PREVIA — no se ha guardado nada",
            contratista: c.name,
            fecha,
            abonos: [
              ...rows.map((r) => ({ contrato: `${r.k.name} (${r.k.projectName})`, monto: usd(r.amount), falta_despues: usd(r.k.valueCents - r.k.allocatedCents - r.amount) })),
              ...(loose ? [{ contrato: "Sin contrato", monto: usd(loose) }] : []),
            ],
            total_abonado: usd(total),
            se_descuenta_de_lo_que_esta_a_cuenta: usd(preview.deductedCents),
            efectivo_a_entregar: usd(preview.cashCents),
            explicacion:
              preview.deductedCents > 0
                ? `Hay $${usd(onAccount).toFixed(2)} a cuenta (cuotas, adelantos, material u otros descuentos ya registrados): se usan primero, así que se entregan $${usd(preview.cashCents).toFixed(2)} en efectivo.`
                : "No hay nada a cuenta: todo el abono se entrega en efectivo.",
            notas: plan.notas,
            codigo_confirmacion: code,
            siguiente_paso: "Muestra esto a la persona. Si lo aprueba, llama de nuevo con los mismos datos, confirmar: true y este codigo_confirmacion.",
          });
        }
        if (args.codigo_confirmacion !== code)
          return fail("El código no coincide con estos datos (cambió algo desde la vista previa). Vuelve a pedir la vista previa y confírmala.");
        const res = await contractors.registerContractorPayment({ contractorId: c.id, date: fecha, lines, looseCents: loose, notes: plan.notas });
        await note("registrar_abono", true, `${c.name} · abono $${usd(total).toFixed(2)} · efectivo $${usd(res.cashCents).toFixed(2)}`);
        return ok({ estado: "REGISTRADO", contratista: c.name, fecha, total_abonado: usd(total), descontado_de_a_cuenta: usd(res.deductedCents), efectivo_entregado: usd(res.cashCents) });
      })
  );

  server.registerTool(
    "registrar_movimiento",
    {
      title: "Registrar movimiento en el estado de cuenta (con vista previa)",
      description:
        "Agrega un movimiento al estado de cuenta de un contratista, igual que 'Agregar movimiento' en la app. Tipos: material y gasto_operativo RESTAN (se le descuentan); extra, bono y trabajo SUMAN (se le deben); ajuste suma o resta según `direccion` (obligatoria solo en ajuste). Un trabajo va siempre a un contrato; un extra, bono o ajuste puede ir a un contrato (sube su valor); un material o gasto puede abonarse a un contrato (cubre parte de lo que falta pagarle). Un material que Ebony asume (`ebony_asume`) queda anotado pero no le resta. Préstamos, adelantos, herramientas, daños e InDrive NO van aquí (en la app van por Préstamos y descuentos, con cuotas); los pagos van con registrar_abono. SIEMPRE en dos pasos: primero sin `confirmar` (vista previa con el saldo antes y después y codigo_confirmacion; no guarda nada); solo si la persona aprueba, vuelve a llamar con los MISMOS datos, `confirmar: true` y el código.",
      inputSchema: {
        contratista: z.string().describe("Nombre o id del contratista"),
        tipo: z.enum(NEW_ENTRY_CATEGORIES as [ContractorLedgerCategory, ...ContractorLedgerCategory[]]).describe("trabajo, extra, bono, material, gasto_operativo o ajuste"),
        monto: z.number().positive().optional().describe("Monto en dólares (o usa m2 + costo_por_m2)"),
        m2: z.number().positive().optional().describe("Metros cuadrados, si se calcula por área (junto con costo_por_m2)"),
        costo_por_m2: z.number().positive().optional().describe("Dólares por m², si se calcula por área"),
        direccion: z.enum(["suma", "resta"]).optional().describe("Solo para ajuste: 'suma' (Ebony le debe más) o 'resta' (le debe menos)"),
        contrato_id: z
          .string()
          .optional()
          .describe("Id del contrato (herramienta contratos). Trabajo/extra/bono/ajuste: el contrato al que pertenece (obligatorio en trabajo). Material/gasto: el contrato al que se abona."),
        ebony_asume: z.boolean().optional().describe("Solo material: true si Ebony asume el costo (queda anotado pero no le resta)"),
        fecha: z.string().optional().describe("YYYY-MM-DD; por defecto hoy"),
        descripcion: z.string().optional().describe("Qué es (ej. '2 láminas de MDF')"),
        cliente: z.string().optional().describe("Cliente u obra, como nota libre"),
        notas: z.string().optional(),
        confirmar: z.boolean().optional(),
        codigo_confirmacion: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      run("registrar_movimiento", async () => {
        const fecha = args.fecha ?? todayInPanama();
        if (!ISO.test(fecha)) return fail("La fecha debe ser YYYY-MM-DD.");
        const category = args.tipo;
        const label = CATEGORY_LABEL[category] ?? category;

        // Dirección: la fija la categoría; solo el ajuste la pregunta.
        const fixed = directionForCategory(category);
        if (fixed && args.direccion) return fail(`Un ${label.toLowerCase()} siempre ${fixed === "a_favor" ? "suma" : "resta"}: no se indica direccion.`);
        if (!fixed && !args.direccion) return fail("En un ajuste indica la direccion: 'suma' o 'resta'. Pregúntale a la persona.");
        const direction = fixed ?? (args.direccion === "suma" ? "a_favor" : "reduce");

        // Monto: fijo, o m² × costo/m² (la misma regla que la pantalla).
        const byArea = args.m2 !== undefined || args.costo_por_m2 !== undefined;
        if (byArea && (args.m2 === undefined || args.costo_por_m2 === undefined)) return fail("Por área se necesitan m2 y costo_por_m2 (los dos).");
        if (byArea === (args.monto !== undefined)) return fail("Indica el monto, o m2 y costo_por_m2 (uno de los dos).");
        const mt2 = byArea ? args.m2! : null;
        const costPerMt2Cents = byArea ? cents(args.costo_por_m2!) : null;
        const amount = lineAmountCents({ mt2, costPerMt2Cents, flatAmountCents: byArea ? 0 : cents(args.monto!) });
        if (amount <= 0) return fail("El monto quedaría en $0.");

        const absorbs = args.ebony_asume ?? false;
        if (absorbs && !isMaterialCategory(category)) return fail("'Ebony asume' solo aplica a material.");

        const isValue = VALUE_CATEGORIES.has(category);
        const isAllocatable = ALLOCATABLE_CATEGORIES.has(category) && !absorbs;
        if (contractRequiredForNew(category) && !args.contrato_id)
          return fail("Un trabajo va siempre a un contrato: indica contrato_id (herramienta contratos) o crea el contrato con crear_contrato.");
        if (args.contrato_id && !isValue && !isAllocatable)
          return fail("Un material que Ebony asume no se abona a ningún contrato (no mueve el saldo): quita contrato_id.");

        const c = await resolveContractor(args.contratista);
        const [contracts, ledger] = await Promise.all([contractors.getContracts({ contractorId: c.id }), contractors.getContractorLedger(c.id)]);
        const k = args.contrato_id ? contracts.find((x) => x.id === args.contrato_id) : undefined;
        if (args.contrato_id && !k) return fail(`El contrato ${args.contrato_id} no es de ${c.name}. Usa la herramienta contratos.`);

        const today = todayInPanama();
        const before = contractorBalanceCents(ledger.filter((e) => !isScheduled(e, today)));
        // Un movimiento suelto cuenta en el saldo de una vez, tenga la fecha que
        // tenga (solo las cuotas de préstamos esperan a su fecha).
        const effect = absorbs ? 0 : direction === "a_favor" ? amount : -amount;

        const plan = {
          contractorId: c.id,
          category,
          direction,
          fecha,
          amount,
          mt2,
          costPerMt2Cents,
          absorbs,
          contractId: isValue ? (k?.id ?? null) : null,
          allocateToContractId: isAllocatable ? (k?.id ?? null) : null,
          descripcion: args.descripcion?.trim() || null,
          cliente: args.cliente?.trim() || null,
          notas: args.notas?.trim() || null,
        };
        const code = confirmationCode(user.id, "registrar_movimiento", plan);

        if (!args.confirmar) {
          const contractLine = !k
            ? null
            : isValue
              ? `Es parte del contrato "${k.name}" (${k.projectName}): su valor sube $${usd(amount).toFixed(2)}.`
              : `Se abona al contrato "${k.name}" (${k.projectName}) hasta lo que le falte por pagar ($${usd(Math.max(0, contractPendingCents(k))).toFixed(2)}); lo que no quepa queda a cuenta.`;
          return ok({
            estado: "VISTA PREVIA — no se ha guardado nada",
            contratista: c.name,
            tipo: label,
            fecha,
            monto: usd(amount),
            ...(byArea ? { calculo: `${mt2} m² × $${usd(costPerMt2Cents!).toFixed(2)}` } : {}),
            efecto: absorbs
              ? "Ebony asume el material: queda anotado pero NO le resta."
              : direction === "a_favor"
                ? `Suma: Ebony le debe $${usd(amount).toFixed(2)} más.`
                : `Resta: se le descuentan $${usd(amount).toFixed(2)}.`,
            contrato: contractLine,
            saldo_hoy: usd(before),
            saldo_despues: usd(before + effect),
            descripcion: plan.descripcion,
            cliente: plan.cliente,
            notas: plan.notas,
            nota_saldo: "saldo positivo = Ebony le debe al contratista; negativo = el contratista le debe a Ebony.",
            codigo_confirmacion: code,
            siguiente_paso: "Muestra esto a la persona. Si lo aprueba, llama de nuevo con los mismos datos, confirmar: true y este codigo_confirmacion.",
          });
        }
        if (args.codigo_confirmacion !== code)
          return fail("El código no coincide con estos datos (cambió algo desde la vista previa). Vuelve a pedir la vista previa y confírmala.");
        const entry = await contractors.createLedgerEntry({
          contractorId: c.id,
          projectId: null,
          contractId: plan.contractId,
          entryDate: fecha,
          category,
          direction,
          mt2,
          costPerMt2Cents,
          amountCents: amount,
          ebonyAbsorbsMaterial: absorbs,
          clientText: plan.cliente,
          description: plan.descripcion,
          notes: plan.notas,
          items: [],
          ...(isAllocatable ? { allocateToContractId: plan.allocateToContractId } : {}),
        });
        await note("registrar_movimiento", true, `${c.name} · ${label} · $${usd(amount).toFixed(2)}`);
        return ok({
          estado: "REGISTRADO",
          movimiento_id: entry.id,
          contratista: c.name,
          tipo: label,
          fecha,
          monto: usd(amount),
          saldo_despues: usd(before + effect),
        });
      })
  );

  server.registerTool(
    "registrar_descuento",
    {
      title: "Registrar préstamo o descuento en cuotas a un contratista (con vista previa)",
      description:
        "Registra un préstamo, adelanto, herramienta, daño, InDrive u otro descuento a un contratista, como 'Préstamos y descuentos' en la app: el monto (más interés, si lo hay) se parte en cuotas, una por quincena, y cada cuota le resta en su fecha (las futuras todavía no cuentan en el saldo). Adelanto e InDrive van siempre en una sola cuota, en la quincena de la fecha. Préstamo y los demás empiezan por defecto la quincena siguiente a la fecha. SIEMPRE en dos pasos: primero sin `confirmar` (vista previa con cada cuota y codigo_confirmacion; no guarda nada); solo si la persona aprueba, vuelve a llamar con los MISMOS datos, `confirmar: true` y el código.",
      inputSchema: {
        contratista: z.string().describe("Nombre o id del contratista"),
        tipo: z.enum(CONTRACTOR_LOAN_CATEGORIES).describe("prestamo, adelanto, herramienta, dano, indrive u otro"),
        monto: z.number().positive().describe("Monto en dólares (sin el interés)"),
        cuotas: z.number().int().min(1).max(52).optional().describe("Número de cuotas quincenales; por defecto 1. Adelanto e InDrive: siempre 1"),
        fecha: z.string().optional().describe("Fecha de la solicitud / del gasto, YYYY-MM-DD; por defecto hoy"),
        primera_quincena: z
          .string()
          .optional()
          .describe("Si se quiere otra quincena para la primera cuota: 'YYYY-MM-1' (1ra quincena) o 'YYYY-MM-2' (2da). Por defecto la que pone la app"),
        interes: z
          .object({
            modo: z.enum(["mensual_pct", "total_pct", "fijo"]).describe("mensual_pct: % por mes del plazo; total_pct: % una vez; fijo: un monto en dólares"),
            valor: z.number().positive().describe("El porcentaje (ej. 5 = 5%) o el monto fijo en dólares"),
          })
          .optional()
          .describe("Solo si la persona dijo que lleva interés"),
        notas: z.string().optional(),
        confirmar: z.boolean().optional(),
        codigo_confirmacion: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      run("registrar_descuento", async () => {
        const fecha = args.fecha ?? todayInPanama();
        if (!ISO.test(fecha)) return fail("La fecha debe ser YYYY-MM-DD.");
        const category = args.tipo;
        const label = CONTRACTOR_LOAN_LABEL[category];
        if (isSingleInstallment(category) && (args.cuotas ?? 1) > 1) return fail(`Un ${label.toLowerCase()} se descuenta en una sola cuota.`);
        let startPeriod: { year: number; month: number; half: 1 | 2 } | undefined;
        if (args.primera_quincena) {
          const m = /^(\d{4})-(\d{2})-([12])$/.exec(args.primera_quincena);
          if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return fail("primera_quincena debe ser 'YYYY-MM-1' o 'YYYY-MM-2'.");
          startPeriod = { year: Number(m[1]), month: Number(m[2]), half: Number(m[3]) as 1 | 2 };
        }
        const interest: LoanInterestInput | null = !args.interes
          ? null
          : args.interes.modo === "fijo"
            ? { mode: "fixed", fixedCents: cents(args.interes.valor) }
            : { mode: args.interes.modo === "mensual_pct" ? "monthly_pct" : "total_pct", ratePct: args.interes.valor };
        const principal = cents(args.monto);
        const loanPlan = planContractorLoan({ category, principalCents: principal, requestDate: fecha, numInstallments: args.cuotas ?? 1, startPeriod, interest });

        const c = await resolveContractor(args.contratista);
        const today = todayInPanama();
        const ledger = await contractors.getContractorLedger(c.id);
        const before = contractorBalanceCents(ledger.filter((e) => !isScheduled(e, today)));
        const dueNow = loanPlan.installments.filter((q) => q.date <= today).reduce((s, q) => s + q.amountCents, 0);
        const total = principal + loanPlan.interestCents;

        const plan = {
          contractorId: c.id,
          category,
          principal,
          fecha,
          numInstallments: loanPlan.numInstallments,
          startPeriod: loanPlan.startPeriod,
          interest,
          notas: args.notas?.trim() || null,
        };
        const code = confirmationCode(user.id, "registrar_descuento", plan);

        if (!args.confirmar) {
          return ok({
            estado: "VISTA PREVIA — no se ha guardado nada",
            contratista: c.name,
            tipo: label,
            fecha,
            monto: usd(principal),
            interes: usd(loanPlan.interestCents),
            total_a_descontar: usd(total),
            cuotas: loanPlan.installments.map((q) => ({
              fecha: q.date,
              quincena: `${q.period.half === 1 ? "1ra" : "2da"} de ${q.period.month}/${q.period.year}`,
              monto: usd(q.amountCents),
              cuenta_hoy: q.date <= today,
            })),
            saldo_hoy: usd(before),
            saldo_hoy_despues: usd(before - dueNow),
            explicacion:
              dueNow === total
                ? "Todo se descuenta ya: el saldo de hoy baja por el total."
                : `Hoy se descuentan $${usd(dueNow).toFixed(2)}; el resto se irá restando en la fecha de cada cuota.`,
            nota_saldo: "saldo positivo = Ebony le debe al contratista; negativo = el contratista le debe a Ebony.",
            notas: plan.notas,
            codigo_confirmacion: code,
            siguiente_paso: "Muestra esto a la persona. Si lo aprueba, llama de nuevo con los mismos datos, confirmar: true y este codigo_confirmacion.",
          });
        }
        if (args.codigo_confirmacion !== code)
          return fail("El código no coincide con estos datos (cambió algo desde la vista previa). Vuelve a pedir la vista previa y confírmala.");
        await contractors.createContractorLoan({
          contractorId: c.id,
          category,
          principalCents: principal,
          requestDate: fecha,
          numInstallments: loanPlan.numInstallments,
          startPeriod: loanPlan.startPeriod,
          interest,
          notes: plan.notas,
        });
        await note("registrar_descuento", true, `${c.name} · ${label} · $${usd(total).toFixed(2)} en ${loanPlan.numInstallments} cuota(s)`);
        return ok({ estado: "REGISTRADO", contratista: c.name, tipo: label, total: usd(total), cuotas: loanPlan.numInstallments, saldo_hoy_despues: usd(before - dueNow) });
      })
  );
}
