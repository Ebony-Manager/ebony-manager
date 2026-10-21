"use server";

import { revalidatePath } from "next/cache";

import { requireAnyModule, requireModule } from "@/lib/auth/dal";
import { intakePatch, jotformDocumentUrlFromNotes, notesWithoutJotformDocument } from "@/lib/personal/jotform-intake";
import { STAFF_PATH } from "@/lib/personal/paths";
import * as intakes from "@/services/staff-intake";
import { getPayrollEmployee, updatePayrollEmployee } from "@/services/payroll-employees";
import { getContractor, updateContractor } from "@/services/contractors";
import { copyJotformDocument, type CopyDocumentError } from "@/services/staff-documents";
import { signedDocumentUrl } from "@/services/photos";

// Bandeja "Nuevos registros" de Staff. Revisarla pide Planilla o
// Contratistas; crear o completar un EMPLEADO pide Planilla y un
// CONTRATISTA pide Contratistas (además de la RLS de cada tabla). Devuelven
// el error como dato: en producción Next oculta el mensaje de un error lanzado.

/** `documentCopied: false` = traía documento pero no se pudo copiar de JotForm (queda el enlace en las notas; `documentError` dice por qué). */
export type IntakeResult = { ok: true; documentCopied?: boolean; documentError?: CopyDocumentError } | { ok: false; error: string };
type Kind = "employee" | "contractor";

const moduleFor = (kind: Kind) => (kind === "employee" ? "planilla" : "contratistas");

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Error";
}

/**
 * Llena en la ficha lo que esté vacío con los datos del registro (nunca pisa
 * nada) y, si la persona no tenía documento, copia el de JotForm a la
 * plataforma. Si no se puede copiar, el enlace queda en las notas.
 * Devuelve si se copió el documento (undefined = no había nada que copiar).
 */
async function applyIntake(
  intakeId: string,
  kind: Kind,
  personId: string
): Promise<{ documentCopied?: boolean; documentError?: CopyDocumentError }> {
  const intake = await intakes.getIntake(intakeId);
  if (!intake) throw new Error("Ese registro ya no existe");
  const person = kind === "employee" ? await getPayrollEmployee(personId) : await getContractor(personId);
  if (!person) throw new Error(kind === "employee" ? "No se encontró al empleado" : "No se encontró al contratista");

  const patch: Parameters<typeof updateContractor>[1] = intakePatch(person, intake);
  let documentCopied: boolean | undefined;
  let documentError: CopyDocumentError | undefined;
  if (intake.idDocumentUrl && !person.idDocumentPath) {
    const res = await copyJotformDocument(kind, personId, intake.idDocumentUrl);
    documentCopied = "path" in res;
    if ("path" in res) {
      patch.idDocumentPath = res.path;
      // Ya está en la ficha: el enlace a JotForm en las notas sobra.
      delete patch.notes;
    } else {
      documentError = res.error;
    }
  }
  if (Object.keys(patch).length) {
    if (kind === "employee") await updatePayrollEmployee(personId, patch);
    else await updateContractor(personId, patch);
  }
  return { documentCopied, documentError };
}

/** Ya se creó la ficha nueva con el formulario prellenado: se cierra el registro. */
export async function markIntakeCreatedAction(intakeId: string, kind: Kind, personId: string): Promise<IntakeResult> {
  const me = await requireModule(moduleFor(kind));
  try {
    const doc = await applyIntake(intakeId, kind, personId);
    await intakes.resolveIntake(intakeId, { status: "created", kind, personId }, me.id);
    revalidatePath(STAFF_PATH, "layout");
    return { ok: true, ...doc };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** La persona ya estaba en el staff: se completa su ficha y se cierra el registro. */
export async function linkIntakeAction(intakeId: string, kind: Kind, personId: string): Promise<IntakeResult> {
  const me = await requireModule(moduleFor(kind));
  try {
    const doc = await applyIntake(intakeId, kind, personId);
    await intakes.resolveIntake(intakeId, { status: "linked", kind, personId }, me.id);
    revalidatePath(STAFF_PATH, "layout");
    return { ok: true, ...doc };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
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

export type ImportDocumentResult =
  | { ok: true; path: string; url: string | null }
  | { ok: false; error: CopyDocumentError | "no_link" | "has_document" | "failed"; status?: number };

/**
 * Trae a la ficha el documento cuyo enlace de JotForm quedó en las notas (la
 * copia automática falló al crear o vincular a la persona). Al copiarlo, la
 * línea del enlace sale de las notas.
 */
export async function importJotformDocumentAction(kind: Kind, personId: string): Promise<ImportDocumentResult> {
  await requireModule(moduleFor(kind));
  try {
    const person = kind === "employee" ? await getPayrollEmployee(personId) : await getContractor(personId);
    if (!person) return { ok: false, error: "failed" };
    if (person.idDocumentPath) return { ok: false, error: "has_document" };
    const link = jotformDocumentUrlFromNotes(person.notes);
    if (!link) return { ok: false, error: "no_link" };
    const res = await copyJotformDocument(kind, personId, link);
    if (!("path" in res)) return { ok: false, error: res.error, status: res.status };
    const patch = { idDocumentPath: res.path, notes: notesWithoutJotformDocument(person.notes) };
    if (kind === "employee") await updatePayrollEmployee(personId, patch);
    else await updateContractor(personId, patch);
    revalidatePath(STAFF_PATH, "layout");
    return { ok: true, path: res.path, url: await signedDocumentUrl(res.path) };
  } catch (err) {
    console.error("No se pudo traer el documento de JotForm", err);
    return { ok: false, error: "failed" };
  }
}
