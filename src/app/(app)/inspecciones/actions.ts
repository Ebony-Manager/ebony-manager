"use server";

import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import * as inspections from "@/services/inspections";
import type { InspectionItemStatus, InspectionPhotoKind } from "@/types/inspections";

// Inspecciones: cada action pide el permiso al entrar (además de la RLS).

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
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

export async function addInspectionItemAction(inspectionId: string, input: inspections.InspectionItemInput, photoPaths: string[]) {
  await requireModule("inspecciones");
  return run(() => inspections.addInspectionItem(inspectionId, input, photoPaths));
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
