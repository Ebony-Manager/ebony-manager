import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { closingRows, closingTotals, type ClosingRow } from "@/lib/contractors/closing";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import * as contractors from "@/services/contractors";
import type { ContractorClosingData } from "@/services/contractors";
import type { McpUser } from "./auth";
import { CODE_MISMATCH, NEXT_STEP, READ_ONLY, confirmationCode, fail, fold, makeReadRegistrar, ok, usd } from "./shared";

/**
 * La Quincena de contratistas por el MCP, en los mismos tres pasos que la
 * pantalla (Personal → Pagos → Contratistas → Cierre) y con el mismo
 * cálculo (lib/contractors/closing.ts):
 *  1. quincena_contratistas: ver lo que se le puede pagar a cada uno y el
 *     borrador (no mueve nada).
 *  2. preparar_quincena_contratistas: poner o quitar abonos en el borrador
 *     (no mueve nada; con vista previa y código).
 *  3. pagar_quincena_contratistas: marcarla pagada — registra el pago de
 *     cada uno con sus descuentos, en una sola transacción de la base (todo
 *     o nada). Con vista previa y código atado al borrador exacto.
 * Reabrir una quincena pagada se hace solo en la app.
 */

type Entry = ContractorClosingData["entries"][number];
type Sel = { year: number; month: number; half: 1 | 2 };

const periodSchema = {
  anio: z.number().int().min(2024).max(2100).optional(),
  mes: z.number().int().min(1).max(12).optional(),
  quincena: z.union([z.literal(1), z.literal(2)]).optional().describe("1 = se paga el 15; 2 = se paga el último día del mes. Por defecto la actual"),
};

function pickPeriod(args: { anio?: number; mes?: number; quincena?: 1 | 2 }): Sel {
  const [y, m, d] = todayInPanama().split("-").map(Number);
  return { year: args.anio ?? y, month: args.mes ?? m, half: args.quincena ?? (d <= 15 ? 1 : 2) };
}
const periodLabel = (s: Sel) => `${s.half === 1 ? "1ra" : "2da"} quincena de ${s.month}/${s.year}`;

function rowOut(r: ClosingRow<Entry>, lines: ContractorClosingData["lines"]) {
  const amount = (kid: string | null) => lines.find((l) => l.contractorId === r.id && l.contractId === kid)?.amountCents ?? 0;
  return {
    contratista: r.name,
    contratista_id: r.id,
    contratos: r.contracts.map(({ contract, pending }) => ({
      contrato_id: contract.id,
      contrato: contract.projectName !== contract.name ? `${contract.name} · ${contract.projectName}` : contract.name,
      se_puede_pagar: usd(pending),
      ...(contract.retentionCents > 0 ? { retenido: usd(contract.retentionCents) } : {}),
      abono_en_borrador: usd(amount(contract.id)),
    })),
    ...(r.loosePending > 0 || amount(null) > 0 ? { sin_contrato: { se_puede_pagar: usd(r.loosePending), abono_en_borrador: usd(amount(null)) } } : {}),
    a_cuenta_por_descontar: usd(r.onAccountCents),
    descuentos: r.onAccount.map((x) => `${x.entry.entryDate} ${x.entry.category}${x.entry.description ? ` (${x.entry.description})` : ""}: $${(x.remainingCents / 100).toFixed(2)}`),
    abonos: usd(r.abonosCents),
    se_descuenta: usd(r.deductedCents),
    efectivo_a_entregar: usd(r.cashCents),
    ...(r.over ? { error: "Algún abono pasa de lo que se le puede pagar" } : {}),
  };
}

export function registerContractorClosingTools(server: McpServer, user: McpUser) {
  const guard = makeReadRegistrar(user);

  server.registerTool(
    "quincena_contratistas",
    {
      title: "Quincena de contratistas",
      description:
        "La quincena de pago de los contratistas, como 'Cierre' en la app: por cada contratista, cuánto se le puede pagar de cada contrato (y de lo acreditado sin contrato), lo que está a cuenta y se le descuenta (cuotas, adelantos, material…), los abonos que ya están en el borrador y el efectivo que resultaría. Si la quincena ya está pagada, lo que se pagó. No cambia nada.",
      inputSchema: periodSchema,
      annotations: READ_ONLY,
    },
    guard("quincena_contratistas", ["contratistas"], async (args: { anio?: number; mes?: number; quincena?: 1 | 2 }) => {
      const sel = pickPeriod(args);
      const data = await contractors.getContractorClosing(sel.year, sel.month, sel.half);
      const paid = data.period?.status === "paid";
      const rows = closingRows(data, paid);
      const t = closingTotals(rows);
      if (paid) {
        return ok({
          quincena: periodLabel(sel),
          estado: "PAGADA",
          fecha_de_pago: data.payDate,
          pagada_el: data.period?.paidAt?.slice(0, 10) ?? null,
          pagos: rows.map((r) => ({ contratista: r.name, abonos: usd(r.paid?.abonosCents), se_desconto: usd(r.paid?.deductedCents), efectivo: usd(r.paid?.cashCents) })),
          totales: { abonos: usd(t.abonos), descontado: usd(t.deducted), efectivo: usd(t.cash) },
          nota: "Para corregirla hay que reabrirla en la app.",
        });
      }
      return ok({
        quincena: periodLabel(sel),
        estado: data.period ? "BORRADOR" : "SIN EMPEZAR",
        fecha_de_pago: data.payDate,
        contratistas: rows.map((r) => rowOut(r, data.lines)),
        totales_del_borrador: { abonos: usd(t.abonos), se_descuenta: usd(t.deducted), efectivo: usd(t.cash) },
        como_sigue: "Para poner abonos usa preparar_quincena_contratistas; para marcarla pagada, pagar_quincena_contratistas. Ninguno guarda sin la vista previa y el sí de la persona.",
      });
    })
  );

  const lineSchema = z.object({
    contratista: z.string().describe("Nombre o id del contratista"),
    contrato_id: z.string().optional().describe("Id del contrato (de quincena_contratistas). Sin esto y con sin_contrato: true, va a lo acreditado sin contrato"),
    sin_contrato: z.boolean().optional(),
    monto: z.number().min(0).describe("Dólares a abonar en esta quincena; 0 = quitar el abono del borrador"),
  });

  server.registerTool(
    "preparar_quincena_contratistas",
    {
      title: "Poner abonos en el borrador de la quincena (con vista previa)",
      description:
        "Pone (o quita, con monto 0) cuánto se le abona a cada contrato de cada contratista en el BORRADOR de la quincena, como escribir en las casillas del Cierre de la app. El borrador no mueve dinero ni saldos: solo prepara. No puede pasar de lo que se le puede pagar a cada contrato. SIEMPRE en dos pasos: primero sin `confirmar` (vista previa con el efectivo que resultaría por contratista y codigo_confirmacion); solo si la persona aprueba, vuelve a llamar con los MISMOS datos, `confirmar: true` y el código.",
      inputSchema: {
        ...periodSchema,
        abonos: z.array(lineSchema).min(1).max(100),
        confirmar: z.boolean().optional(),
        codigo_confirmacion: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    guard(
      "preparar_quincena_contratistas",
      ["contratistas"],
      async (args: { anio?: number; mes?: number; quincena?: 1 | 2; abonos: z.infer<typeof lineSchema>[]; confirmar?: boolean; codigo_confirmacion?: string }) => {
        const sel = pickPeriod(args);
        const data = await contractors.getContractorClosing(sel.year, sel.month, sel.half);
        if (data.period?.status === "paid") return fail(`La ${periodLabel(sel)} ya está pagada: para cambiarla hay que reabrirla en la app.`);

        // Cada línea pedida → contratista y contrato concretos.
        const changes = args.abonos.map((a) => {
          const q = fold(a.contratista);
          const exact = data.contractors.filter((c) => c.id === a.contratista || fold(c.name) === q);
          const list = exact.length ? exact : data.contractors.filter((c) => fold(c.name).includes(q));
          if (list.length !== 1)
            throw new Error(
              list.length ? `Varios contratistas coinciden con "${a.contratista}": ${list.map((c) => c.name).join("; ")}. Pregunta cuál.` : `No encontré al contratista "${a.contratista}".`
            );
          const c = list[0];
          if (!a.contrato_id && !a.sin_contrato) throw new Error(`Para ${c.name} indica contrato_id, o sin_contrato: true.`);
          if (a.contrato_id && a.sin_contrato) throw new Error(`Para ${c.name} indica contrato_id o sin_contrato, no los dos.`);
          if (a.contrato_id && !data.contracts.some((k) => k.id === a.contrato_id && k.contractorId === c.id))
            throw new Error(`El contrato ${a.contrato_id} no es de ${c.name}. Usa quincena_contratistas para ver sus contratos.`);
          return { contractorId: c.id, name: c.name, contractId: a.contrato_id ?? null, amountCents: Math.round(a.monto * 100) };
        });
        const key = (cid: string, kid: string | null) => `${cid}:${kid ?? "-"}`;
        if (new Set(changes.map((x) => key(x.contractorId, x.contractId))).size !== changes.length) return fail("Una misma línea aparece dos veces: júntala.");

        // El borrador como quedaría, y las filas con el mismo cálculo de la pantalla.
        const after = new Map(data.lines.map((l) => [key(l.contractorId, l.contractId), l.amountCents]));
        for (const x of changes) after.set(key(x.contractorId, x.contractId), x.amountCents);
        const before = closingRows(data, false);
        const rows = closingRows(data, false, (cid, kid) => after.get(key(cid, kid)) ?? 0);
        const touched = new Set(changes.map((x) => x.contractorId));
        for (const x of changes) {
          const r = rows.find((row) => row.id === x.contractorId);
          if (x.amountCents === 0) continue;
          if (!r) return fail(`${x.name} no tiene nada por pagar en esta quincena.`);
          const limit = x.contractId ? r.contracts.find((k) => k.contract.id === x.contractId)?.pending : r.loosePending;
          if (limit === undefined || limit <= 0) return fail(`A ese ${x.contractId ? "contrato" : "saldo sin contrato"} de ${x.name} no se le puede abonar nada hoy.`);
          if (x.amountCents > limit) return fail(`A ${x.name} se le pueden abonar hasta $${(limit / 100).toFixed(2)} ahí (pediste $${(x.amountCents / 100).toFixed(2)}).`);
        }

        const plan = { sel, changes: changes.map(({ contractorId, contractId, amountCents }) => ({ contractorId, contractId, amountCents })) };
        const code = confirmationCode(user.id, "preparar_quincena_contratistas", plan);
        if (!args.confirmar) {
          const t = closingTotals(rows);
          return ok({
            estado: "VISTA PREVIA — no se ha guardado nada",
            quincena: periodLabel(sel),
            fecha_de_pago: data.payDate,
            cambios: rows
              .filter((r) => touched.has(r.id))
              .map((r) => {
                const b = before.find((x) => x.id === r.id);
                return { contratista: r.name, abonos_antes: usd(b?.abonosCents ?? 0), abonos_despues: usd(r.abonosCents), se_descuenta: usd(r.deductedCents), efectivo_a_entregar: usd(r.cashCents) };
              }),
            totales_del_borrador_despues: { abonos: usd(t.abonos), se_descuenta: usd(t.deducted), efectivo: usd(t.cash) },
            nota: "Es solo el borrador: no mueve dinero ni saldos hasta marcar la quincena pagada.",
            codigo_confirmacion: code,
            siguiente_paso: NEXT_STEP,
          });
        }
        if (args.codigo_confirmacion !== code) return fail(CODE_MISMATCH);
        for (const x of changes) {
          await contractors.setContractorPayLine({ ...sel, contractorId: x.contractorId, contractId: x.contractId, amountCents: x.amountCents });
        }
        return ok({ estado: "BORRADOR GUARDADO", quincena: periodLabel(sel), lineas: changes.length, nota: "Todavía no se ha pagado nada. Para marcarla pagada usa pagar_quincena_contratistas." });
      }
    )
  );

  server.registerTool(
    "pagar_quincena_contratistas",
    {
      title: "Marcar la quincena de contratistas como pagada (con vista previa)",
      description:
        "Marca la quincena como PAGADA, como 'Marcar pagada' en el Cierre de la app: con lo que está en el borrador, registra el pago de cada contratista a la fecha de pago, descontando primero lo que está a cuenta; cada contrato avanza y los saldos bajan. Es todo o nada. Esto SÍ mueve el dinero de la app: muestra la vista previa (cuánto efectivo se le entrega a cada uno y el total) y confirma SOLO si la persona dice claramente que sí. Para deshacerlo hay que reabrir la quincena en la app.",
      inputSchema: { ...periodSchema, confirmar: z.boolean().optional(), codigo_confirmacion: z.string().optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    guard("pagar_quincena_contratistas", ["contratistas"], async (args: { anio?: number; mes?: number; quincena?: 1 | 2; confirmar?: boolean; codigo_confirmacion?: string }) => {
      const sel = pickPeriod(args);
      const data = await contractors.getContractorClosing(sel.year, sel.month, sel.half);
      if (!data.period) return fail(`La ${periodLabel(sel)} no tiene abonos en el borrador: no hay nada que pagar.`);
      if (data.period.status === "paid") return fail(`La ${periodLabel(sel)} ya está pagada.`);
      const rows = closingRows(data, false).filter((r) => r.abonosCents > 0);
      if (rows.length === 0) return fail(`La ${periodLabel(sel)} no tiene abonos en el borrador: no hay nada que pagar.`);
      const over = rows.filter((r) => r.over);
      if (over.length) return fail(`Hay abonos que pasan de lo que se puede pagar (${over.map((r) => r.name).join(", ")}). Corrígelos con preparar_quincena_contratistas o en la app.`);
      const t = closingTotals(rows);
      // El código se ata al borrador exacto: si alguien lo cambia entre la vista previa y el sí, no coincide.
      const plan = {
        periodId: data.period.id,
        lines: [...data.lines].sort((a, b) => `${a.contractorId}${a.contractId}`.localeCompare(`${b.contractorId}${b.contractId}`)),
        cash: t.cash,
      };
      const code = confirmationCode(user.id, "pagar_quincena_contratistas", plan);
      if (!args.confirmar) {
        return ok({
          estado: "VISTA PREVIA — no se ha pagado nada",
          quincena: periodLabel(sel),
          fecha_de_pago: data.payDate,
          pagos: rows.map((r) => ({ contratista: r.name, abonos: usd(r.abonosCents), se_descuenta: usd(r.deductedCents), efectivo_a_entregar: usd(r.cashCents) })),
          totales: { abonos: usd(t.abonos), se_descuenta: usd(t.deducted), efectivo_a_entregar: usd(t.cash) },
          advertencia: "Al confirmar se registra el pago de cada contratista (con sus descuentos), los contratos avanzan y los saldos bajan. Para deshacerlo hay que reabrir la quincena en la app.",
          codigo_confirmacion: code,
          siguiente_paso: "Muestra la lista y el total a la persona y pregúntale si la marca pagada. Solo con un sí claro, llama de nuevo con confirmar: true y este codigo_confirmacion.",
        });
      }
      if (args.codigo_confirmacion !== code) return fail(CODE_MISMATCH);
      await contractors.closeContractorPayPeriod(data.period.id);
      const done = await contractors.getContractorClosing(sel.year, sel.month, sel.half);
      const paidRows = closingRows(done, true);
      const pt = closingTotals(paidRows);
      return ok({
        estado: "PAGADA",
        quincena: periodLabel(sel),
        pagos: paidRows.map((r) => ({ contratista: r.name, abonos: usd(r.paid?.abonosCents), se_desconto: usd(r.paid?.deductedCents), efectivo: usd(r.paid?.cashCents) })),
        totales: { abonos: usd(pt.abonos), descontado: usd(pt.deducted), efectivo: usd(pt.cash) },
      });
    })
  );
}
