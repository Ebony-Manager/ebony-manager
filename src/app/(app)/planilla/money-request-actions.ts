"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import * as requests from "@/services/money-requests";
import { createLedgerEntry } from "@/services/contractors";

// Bandeja "Solicitudes de dinero" (Planilla → Préstamos). Registrar a un
// EMPLEADO pide Planilla (el préstamo se crea con el formulario de siempre,
// createLoanAction); a un CONTRATISTA, Contratistas. Devuelven el error como
// dato: en producción Next oculta el mensaje de un error lanzado.

export type MoneyRequestResult = { ok: true } | { ok: false; error: string };

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Error";
}

function revalidate() {
  revalidatePath("/planilla");
  revalidatePath("/", "layout");
}

/** El préstamo/adelanto del empleado ya se creó en su planilla: se cierra la solicitud. */
export async function markMoneyRequestRegisteredAction(id: string, employeeId: string): Promise<MoneyRequestResult> {
  const me = await requireModule("planilla");
  try {
    await requests.resolveMoneyRequest(id, { status: "registered", kind: "employee", personId: employeeId }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidate();
  return { ok: true };
}

/**
 * Contratista: se anota en su estado de cuenta como Adelanto o Préstamo que
 * reduce lo que Ebony le debe, por el monto a descontar (con el 20% si es
 * préstamo), con la fecha de la solicitud.
 */
export async function registerContractorMoneyRequestAction(id: string, contractorId: string): Promise<MoneyRequestResult> {
  const me = await requireModule("contratistas");
  try {
    const req = await requests.getMoneyRequest(id);
    if (!req) throw new Error("Esa solicitud ya no existe");
    if (!req.type || !req.deductCents) throw new Error("La solicitud no trae tipo o monto");
    await createLedgerEntry({
      contractorId,
      entryDate: req.receivedAt.slice(0, 10),
      category: req.type,
      direction: "reduce",
      amountCents: req.deductCents,
      description: req.type === "prestamo" ? "Préstamo solicitado por JotForm" : "Adelanto solicitado por JotForm",
      notes:
        req.type === "prestamo" && req.amountCents
          ? `Entregado $${(req.amountCents / 100).toFixed(2)} + 20% de recargo`
          : null,
    });
    await requests.resolveMoneyRequest(id, { status: "registered", kind: "contractor", personId: contractorId }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath("/contratistas");
  revalidatePath("/personal/staff", "layout");
  revalidate();
  return { ok: true };
}

export async function dismissMoneyRequestAction(id: string): Promise<MoneyRequestResult> {
  const me = await requireAnyModule("planilla", "contratistas");
  try {
    await requests.resolveMoneyRequest(id, { status: "dismissed" }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidate();
  return { ok: true };
}
