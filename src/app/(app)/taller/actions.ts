"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireModule } from "@/lib/auth/dal";
import { driveEnabled, driveRoot, ensureSubfolders, getItem, startUpload, trashItem } from "@/lib/google/drive";
import { dispatchPendingPush } from "@/lib/notifications/push";
import * as taller from "@/services/taller";
import { PAINT_SAMPLE_KINDS, WORK_ORDER_FILE_MAX, WORK_ORDER_STATUSES, type WorkOrderEvent, type WorkOrderFile, type WorkOrderStatus } from "@/types/taller";
import { sendEmail, simpleEmail } from "@/lib/email/send";
import { formatDate } from "@/lib/planilla/format";
import { projectPath } from "@/app/(app)/proyectos/paths";

// Taller · Trabajos (por ahora CNC). Ver TALLER-PLAN.md. Todo pide el permiso `taller` (la RLS lo repite).

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/** La pantalla de Taller y, si aplica, la ficha del proyecto (sin refrescar en la pantalla además: ver UI-RULES). */
function revalidate(projectIds: (string | null | undefined)[] = []) {
  revalidatePath("/taller");
  for (const id of new Set(projectIds)) if (id) revalidatePath(projectPath(id));
}

/** Manda los avisos al teléfono que dejó la base (asignado / listo). Si falla, el aviso queda en la campana igual. */
async function pushNow() {
  await dispatchPendingPush().catch(() => undefined);
}

export async function getWorkOrderEventsAction(id: string): Promise<Result<WorkOrderEvent[]>> {
  await requireModule("taller");
  return run(() => taller.getWorkOrderEvents(id));
}

export async function saveWorkOrderAction(
  id: string | null,
  input: taller.WorkOrderInput,
  previousProjectId?: string | null,
): Promise<Result<string>> {
  await requireModule("taller");
  const clean: taller.WorkOrderInput = {
    title: input.title.trim(),
    projectId: input.projectId || null,
    assigneeId: input.assigneeId || null,
    dueDate: input.dueDate || null,
    notes: input.notes?.trim() || null,
  };
  if (!clean.title) return { ok: false, error: "Falta el título." };
  const res = await run(async () => {
    if (id) {
      await taller.updateWorkOrder(id, clean);
      return id;
    }
    return taller.createWorkOrder(clean);
  });
  if (res.ok) {
    await pushNow();
    revalidate([clean.projectId, previousProjectId]);
  }
  return res;
}

export async function setWorkOrderStatusAction(id: string, status: WorkOrderStatus, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  if (!WORK_ORDER_STATUSES.includes(status)) return { ok: false, error: "Estado inválido." };
  const res = await run(async () => {
    await taller.setWorkOrderStatus(id, status);
    return null;
  });
  if (res.ok) {
    await pushNow();
    revalidate([projectId]);
  }
  return res;
}

/** Borra el trabajo y manda sus archivos a la papelera de Drive (se recuperan ahí por 30 días). */
export async function deleteWorkOrderAction(id: string, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    const files = await taller.deleteWorkOrder(id);
    if (driveEnabled()) await Promise.all(files.map((f) => trashItem(f).catch(() => undefined)));
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}

/**
 * La carpeta donde viven los archivos del trabajo: la subcarpeta CNC del proyecto (si el proyecto tiene carpeta en
 * Drive), o TALLER/CNC para los internos y los proyectos sin carpeta. Se guarda en el trabajo la primera vez.
 */
async function workOrderFolder(id: string): Promise<string> {
  const info = await taller.getWorkOrderFolderInfo(id);
  if (info.folderId) return info.folderId;
  const sub = info.kind === "muestra" ? "MUESTRAS" : "CNC";
  const root = driveRoot();
  if (!driveEnabled() || !root) throw new Error("Drive no está conectado (faltan las variables en Vercel).");
  const projectFolder = info.projectId ? await taller.getProjectDriveFolder(info.projectId) : null;
  const base = projectFolder ?? (await ensureSubfolders(root, ["TALLER"])).get("TALLER")!;
  const folder = (await ensureSubfolders(base, [sub])).get(sub)!;
  await taller.setWorkOrderFolder(id, folder);
  return folder;
}

/** Abre la subida de un archivo: el navegador lo manda directo a Drive (sin pasar por el servidor). */
export async function startWorkOrderUploadAction(id: string, name: string, mimeType: string, size: number): Promise<Result<string>> {
  await requireModule("taller");
  if (size > WORK_ORDER_FILE_MAX)
    return { ok: false, error: `«${name}» pesa más de 4 MB: la app no lo podría descargar después. Los DXF suelen pesar menos de 200 KB.` };
  const origin = (await headers()).get("origin");
  return run(async () => startUpload(await workOrderFolder(id), name, mimeType, size, origin));
}

/** Anota en el trabajo los archivos ya subidos (comprueba que de verdad estén en su carpeta). Refresca una sola vez. */
export async function registerWorkOrderFilesAction(
  id: string,
  files: { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null; sampleId?: string | null; role?: WorkOrderFile["role"] }[],
  projectId: string | null,
): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    const folder = await workOrderFolder(id);
    for (const file of files) {
      const item = await getItem(file.driveFileId);
      if (item.parentId !== folder) throw new Error(`«${file.name}» no quedó en la carpeta del trabajo.`);
      await taller.addWorkOrderFile(id, { ...file, name: item.name, mimeType: item.mimeType, sizeBytes: item.size ?? file.sizeBytes });
    }
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}

/** Quita un archivo del trabajo y lo manda a la papelera de Drive. */
export async function removeWorkOrderFileAction(fileId: string, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    const driveId = await taller.removeWorkOrderFile(fileId);
    if (driveEnabled()) await trashItem(driveId).catch(() => undefined);
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}

// ── Muestras de pintura ────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = { sherwin_williams: "Sherwin Williams", benjamin_moore: "Benjamin Moore", chapilla: "Chapilla", otro: "Otro" };

/** Correo al pintor con la solicitud (no tiene usuario en la app todavía). No rompe si falla. */
async function emailPainter(id: string): Promise<string | null> {
  try {
    const order = await taller.getWorkOrder(id);
    if (!order?.assigneeContractorId) return null;
    const [contacts, veneers, projects] = await Promise.all([
      taller.getContactEmails(order.assigneeContractorId, order.requestedBy),
      taller.getVeneerTypes(),
      taller.getTallerProjects(),
    ]);
    if (!contacts.contractorEmail) return `${contacts.contractorName ?? "El pintor"} no tiene correo registrado en Contratistas.`;
    const origin = (await headers()).get("origin") ?? "";
    const project = projects.find((p) => p.id === order.projectId)?.name ?? "Taller interno";
    const veneer = (vid: string | null) => veneers.find((v) => v.id === vid)?.name;
    const { html, text } = simpleEmail({
      title: "Nueva muestra de pintura",
      rows: [
        ["Proyecto", project],
        ["Para", order.dueDate ? formatDate("es", order.dueDate) : "Sin fecha"],
        ["Pedida por", contacts.userName ?? "—"],
        ...(order.notes ? ([["Notas", order.notes]] as [string, string][]) : []),
      ],
      listTitle: "Muestras",
      list: order.samples.map((x) => [x.name, KIND_LABEL[x.kind], x.kind === "chapilla" ? veneer(x.veneerTypeId) : null].filter(Boolean).join(" · ")),
      buttonLabel: "Ver en Ebony Manager",
      buttonUrl: origin ? `${origin}/taller?trabajo=${id}` : undefined,
    });
    const res = await sendEmail({ to: [contacts.contractorEmail], subject: `Muestra de pintura · ${project}`, html, text });
    return res.ok ? null : `No se pudo mandar el correo al pintor: ${res.error}`;
  } catch (err) {
    return `No se pudo mandar el correo al pintor: ${err instanceof Error ? err.message : "Error"}`;
  }
}

/**
 * Crea o edita una solicitud de muestras. Devuelve el id del trabajo, los ids de las muestras nuevas (para subirles
 * sus fotos de referencia) y, si el correo al pintor no salió, el motivo (la solicitud queda guardada igual).
 */
export async function saveSampleRequestAction(
  id: string | null,
  input: taller.SampleRequestInput,
  previous?: { projectId: string | null; contractorId: string | null },
): Promise<Result<{ id: string; newSampleIds: string[]; emailWarning: string | null }>> {
  await requireModule("taller");
  const samples = input.samples
    .map((x) => ({ ...x, name: x.name.trim() }))
    .filter((x) => x.name);
  if (samples.length === 0) return { ok: false, error: "Agrega al menos una muestra con su nombre." };
  if (samples.some((x) => !PAINT_SAMPLE_KINDS.includes(x.kind))) return { ok: false, error: "Tipo de muestra inválido." };
  if (samples.some((x) => x.kind === "chapilla" && !x.veneerTypeId)) return { ok: false, error: "Elige el tipo de chapilla." };
  const clean: taller.SampleRequestInput = {
    projectId: input.projectId || null,
    contractorId: input.contractorId || null,
    dueDate: input.dueDate || null,
    notes: input.notes?.trim() || null,
    samples,
  };
  const res = await run(async () => {
    if (id) return { id, newSampleIds: await taller.updateSampleRequest(id, clean) };
    const created = await taller.createSampleRequest(clean);
    return { id: created.id, newSampleIds: created.sampleIds };
  });
  if (!res.ok) return res;
  // Aviso por correo al pintor: al crearla, o si se le pasó a otro pintor.
  const notify = !!clean.contractorId && (!id || clean.contractorId !== previous?.contractorId);
  const emailWarning = notify ? await emailPainter(res.data.id) : null;
  revalidate([clean.projectId, previous?.projectId]);
  return { ok: true, data: { ...res.data, emailWarning } };
}

export async function setSampleCodeAction(sampleId: string, code: string, projectId: string | null): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    await taller.setSampleOfficialCode(sampleId, code.trim() || null);
    return null;
  });
  if (res.ok) revalidate([projectId]);
  return res;
}

export async function setPainterInTurnAction(contractorId: string, inTurn: boolean): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    await taller.setPainterInTurn(contractorId, inTurn);
    return null;
  });
  if (res.ok) revalidate();
  return res;
}

export async function addVeneerTypeAction(name: string): Promise<Result> {
  await requireModule("taller");
  if (!name.trim()) return { ok: false, error: "Escribe el tipo de chapilla." };
  const res = await run(async () => {
    await taller.addVeneerType(name);
    return null;
  });
  if (res.ok) revalidate();
  return res;
}

export async function setVeneerTypeActiveAction(id: string, active: boolean): Promise<Result> {
  await requireModule("taller");
  const res = await run(async () => {
    await taller.setVeneerTypeActive(id, active);
    return null;
  });
  if (res.ok) revalidate();
  return res;
}
