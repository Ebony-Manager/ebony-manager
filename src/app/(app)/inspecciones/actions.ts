"use server";

import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import * as inspections from "@/services/inspections";
import type { InspectionArea } from "@/types/inspections";
import type { InspectionItemStatus, InspectionPhotoKind } from "@/types/inspections";
import { dispatchPendingPush } from "@/lib/notifications/push";

// Inspecciones: cada action pide el permiso al entrar (además de la RLS).

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    await dispatchPendingPush().catch(() => undefined);
    revalidatePath("/inspecciones", "layout");
    revalidatePath("/proyectos", "layout");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

async function actorName(): Promise<string | null> {
  const profile = await requireModule("inspecciones");
  return profile.full_name || profile.email;
}

export async function createInspectionAction(projectId: string, input: inspections.InspectionInput) {
  const name = await actorName();
  return run(() => inspections.createInspection(projectId, input, name));
}

export async function updateInspectionAction(id: string, input: inspections.InspectionInput) {
  await requireModule("inspecciones");
  return run(() => inspections.updateInspection(id, input));
}

export async function deleteInspectionAction(id: string) {
  await requireModule("inspecciones");
  return run(() => inspections.deleteInspection(id));
}

export async function addInspectionItemsAction(inspectionId: string, entries: { input: inspections.InspectionItemInput; photoPaths: string[] }[]) {
  await requireModule("inspecciones");
  return run(() => inspections.addInspectionItems(inspectionId, entries));
}

export async function updateInspectionItemAction(id: string, input: inspections.InspectionItemInput, newPhotoPaths: string[]) {
  await requireModule("inspecciones");
  return run(async () => {
    await inspections.updateInspectionItem(id, input);
    await inspections.addInspectionPhotos(id, newPhotoPaths, "antes");
  });
}

export async function deleteInspectionItemAction(id: string) {
  await requireModule("inspecciones");
  return run(() => inspections.deleteInspectionItem(id));
}

export async function setInspectionItemStatusAction(id: string, status: InspectionItemStatus) {
  const name = await actorName();
  return run(() => inspections.setInspectionItemStatus(id, status, name));
}

export async function addInspectionPhotosAction(itemId: string, paths: string[], kind: InspectionPhotoKind) {
  await requireModule("inspecciones");
  return run(() => inspections.addInspectionPhotos(itemId, paths, kind));
}

export async function deleteInspectionPhotoAction(id: string) {
  await requireModule("inspecciones");
  return run(() => inspections.deleteInspectionPhoto(id));
}

// ── Programación ────────────────────────────────────────────────────────

type PersonRef = { kind: "empleado" | "contratista"; id: string } | null;

export async function planItemsAction(itemIds: string[], date: string, before: string | null, person: PersonRef) {
  await requireModule("inspecciones");
  return run(() => inspections.planItems(itemIds, date, before, person));
}

export async function assignSchedulesAction(ids: string[], person: PersonRef) {
  await requireModule("inspecciones");
  return run(() => inspections.assignSchedules(ids, person));
}

export async function setScheduleNoteAction(ids: string[], note: string | null) {
  await requireModule("inspecciones");
  return run(() => inspections.setScheduleNote(ids, note));
}

export async function unplanItemsAction(itemIds: string[]) {
  await requireModule("inspecciones");
  return run(() => inspections.unplanItems(itemIds));
}

// ── Áreas de la obra ────────────────────────────────────────────────────

// Solo lectura: NO pasa por `run` (que revalida la página). Revalidar aquí
// volvía a pintar la obra, que volvía a pedir las áreas… en bucle.
export async function listAreasAction(projectId: string): Promise<ActionResult<InspectionArea[]>> {
  await requireModule("inspecciones");
  try {
    return { ok: true, data: await inspections.getProjectAreas(projectId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function createAreaAction(projectId: string, name: string) {
  await requireModule("inspecciones");
  return run(() => inspections.createArea(projectId, name));
}

export async function renameAreaAction(id: string, name: string) {
  await requireModule("inspecciones");
  return run(() => inspections.renameArea(id, name));
}

export async function mergeAreasAction(from: string, into: string) {
  await requireModule("inspecciones");
  return run(() => inspections.mergeAreas(from, into));
}

export async function deleteAreaAction(id: string) {
  await requireModule("inspecciones");
  return run(() => inspections.deleteArea(id));
}
