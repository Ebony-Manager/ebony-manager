"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import * as requests from "@/services/money-requests";
import { PAGOS_PATH } from "@/lib/personal/paths";

// Bandeja "Solicitudes de dinero" (Personal → Pagos → Préstamos). El préstamo
// o adelanto se crea con el formulario de cuotas de siempre (LoanDialog) y
// acá solo se cierra la solicitud: a un EMPLEADO pide Planilla; a un
// CONTRATISTA, Contratistas. Devuelven el error como
// dato: en producción Next oculta el mensaje de un error lanzado.

export type MoneyRequestResult = { ok: true } | { ok: false; error: string };

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Error";
}

function revalidate() {
  revalidatePath(PAGOS_PATH);
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

/** El préstamo/adelanto del contratista ya se creó en su estado de cuenta: se cierra la solicitud. */
export async function markContractorMoneyRequestRegisteredAction(id: string, contractorId: string): Promise<MoneyRequestResult> {
  const me = await requireModule("contratistas");
  try {
    await requests.resolveMoneyRequest(id, { status: "registered", kind: "contractor", personId: contractorId }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
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
