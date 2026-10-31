"use server";

import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import * as ventas from "@/services/ventas";
import { addProjectSubfolders, trashOpportunityFolder } from "@/services/drive-opportunity";
import type { LostReason, Stage } from "@/types/ventas";

// Ventas (Seguimiento y Clientes): todo con el permiso Cotización; la RLS
// lo repite. Devuelven { ok, error } para mostrar el error en la pantalla.

export type VentasResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<VentasResult<T>> {
  await requireModule("cotizacion");
  try {
    const data = await fn();
    revalidatePath("/cotizacion", "layout");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function createClientAction(input: ventas.ClientInput) {
  return run(() => ventas.createClientRecord(input));
}

export async function updateClientAction(id: string, input: ventas.ClientInput) {
  return run(() => ventas.updateClientRecord(id, input));
}

export async function createOpportunityAction(input: ventas.OpportunityInput) {
  return run(() => ventas.createOpportunity(input));
}

export async function updateOpportunityAction(id: string, input: ventas.OpportunityInput) {
  return run(async () => {
    await ventas.updateOpportunity(id, input);
    // Perdida: su carpeta de Drive se borra (queda 30 días en la papelera de Drive).
    if (input.stage === "perdida") await trashOpportunityFolder(id);
  });
}

export async function setOpportunityStageAction(id: string, stage: Stage, lostReason: LostReason | null, lostNote: string | null) {
  return run(async () => {
    await ventas.setOpportunityStage(id, stage, lostReason, lostNote);
    if (stage === "perdida") await trashOpportunityFolder(id);
  });
}

export async function approveOpportunityAction(id: string, projectName: string | null, projectId: string | null) {
  return run(async () => {
    const project = await ventas.approveOpportunity(id, projectName, projectId);
    // Aprobada: su carpeta recibe las subcarpetas del proyecto (medidas, sketchup…).
    await addProjectSubfolders(id);
    return project;
  });
}

export async function deleteOpportunityAction(id: string) {
  return run(() => ventas.deleteOpportunity(id));
}

export async function getOpportunityNotesAction(id: string) {
  return run(() => ventas.getOpportunityNotes(id));
}

export async function addOpportunityNoteAction(id: string, body: string) {
  return run(() => ventas.addOpportunityNote(id, body));
}
