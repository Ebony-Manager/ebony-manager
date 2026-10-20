"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import { intakePatch } from "@/lib/personal/jotform-intake";
import { STAFF_PATH } from "@/lib/personal/paths";
import * as intakes from "@/services/staff-intake";
import { getPayrollEmployee, updatePayrollEmployee } from "@/services/payroll-employees";
import { getContractor, updateContractor } from "@/services/contractors";

// Bandeja "Nuevos registros" de Staff. Revisarla pide Planilla o
// Contratistas; crear o completar un EMPLEADO pide Planilla y un
// CONTRATISTA pide Contratistas (además de la RLS de cada tabla). Devuelven
// el error como dato: en producción Next oculta el mensaje de un error lanzado.

export type IntakeResult = { ok: true } | { ok: false; error: string };
type Kind = "employee" | "contractor";

const moduleFor = (kind: Kind) => (kind === "employee" ? "planilla" : "contratistas");

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Error";
}

/** Llena en la ficha lo que esté vacío con los datos del registro (nunca pisa nada). */
async function applyIntake(intakeId: string, kind: Kind, personId: string) {
  const intake = await intakes.getIntake(intakeId);
  if (!intake) throw new Error("Ese registro ya no existe");
  if (kind === "employee") {
    const person = await getPayrollEmployee(personId);
    if (!person) throw new Error("No se encontró al empleado");
    const patch = intakePatch(person, intake);
    if (Object.keys(patch).length) await updatePayrollEmployee(personId, patch);
  } else {
    const person = await getContractor(personId);
    if (!person) throw new Error("No se encontró al contratista");
    const patch = intakePatch(person, intake);
    if (Object.keys(patch).length) await updateContractor(personId, patch);
  }
}

/** Ya se creó la ficha nueva con el formulario prellenado: se cierra el registro. */
export async function markIntakeCreatedAction(intakeId: string, kind: Kind, personId: string): Promise<IntakeResult> {
  const me = await requireModule(moduleFor(kind));
  try {
    await applyIntake(intakeId, kind, personId);
    await intakes.resolveIntake(intakeId, { status: "created", kind, personId }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(STAFF_PATH, "layout");
  return { ok: true };
}

/** La persona ya estaba en el staff: se completa su ficha y se cierra el registro. */
export async function linkIntakeAction(intakeId: string, kind: Kind, personId: string): Promise<IntakeResult> {
  const me = await requireModule(moduleFor(kind));
  try {
    await applyIntake(intakeId, kind, personId);
    await intakes.resolveIntake(intakeId, { status: "linked", kind, personId }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(STAFF_PATH, "layout");
  return { ok: true };
}

export async function dismissIntakeAction(intakeId: string): Promise<IntakeResult> {
  const me = await requireAnyModule("planilla", "contratistas");
  try {
    await intakes.resolveIntake(intakeId, { status: "dismissed" }, me.id);
  } catch (err) {
    return { ok: false, error: message(err) };
  }
  revalidatePath(STAFF_PATH, "layout");
  return { ok: true };
}
