"use client";

import * as React from "react";
import { CalendarDays, Palette, Paperclip } from "lucide-react";

import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { THUMB_WIDTH, photoUrl } from "@/lib/photo-url";
import { StatusBadge } from "@/components/shared/status-badge";
import { ContractorAvatar } from "@/app/(app)/contratistas/contractor-avatar";
import type { TallerPainter, TallerPerson, WorkOrder, WorkOrderFile, WorkOrderStatus } from "@/types/taller";
import { registerWorkOrderFilesAction, startWorkOrderUploadAction } from "./actions";

export type Tt = (k: keyof typeof strings.taller, vars?: Record<string, string | number>) => string;

export function useTt() {
  const { lang } = useLang();
  const tt: Tt = React.useCallback(
    (k, vars) => {
      let s = t(lang, strings.taller[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    [lang],
  );
  return { lang, tt };
}

export const statusLabel = (tt: Tt, s: WorkOrderStatus) => tt(`status_${s}`);

export function WorkStatusBadge({ status, tt }: { status: WorkOrderStatus; tt: Tt }) {
  return <StatusBadge status={`work_${status}`}>{statusLabel(tt, status)}</StatusBadge>;
}

/** Foto de la persona (miniatura fija en caché, ver UI-RULES) o su inicial. */
export function PersonAvatar({ person, size = "sm" }: { person: TallerPerson | undefined; size?: "sm" | "md" }) {
  if (!person) return null;
  return (
    <ContractorAvatar
      name={person.name}
      photoUrl={person.photoPath ? photoUrl("employee-photos", person.photoPath, THUMB_WIDTH) : null}
      size={size}
    />
  );
}

export const isOverdue = (o: Pick<WorkOrder, "dueDate" | "status">) =>
  !!o.dueDate && (o.status === "por_hacer" || o.status === "en_proceso") && o.dueDate < todayInPanama();

/** Tarjeta de un trabajo (tablero, lista y ficha del proyecto). */
export function WorkOrderCard({
  order,
  person,
  painter,
  tt,
  showProject = true,
  onOpen,
}: {
  order: WorkOrder;
  person: TallerPerson | undefined;
  /** Para muestras: el pintor (contratista). */
  painter?: TallerPainter;
  tt: Tt;
  showProject?: boolean;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  const late = isOverdue(order);
  const isSample = order.kind === "muestra";
  const who = isSample ? painter?.name : person?.name;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-foreground">{order.title}</p>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{isSample ? tt("kind_muestra") : tt("kind_cnc")}</span>
      </div>
      {showProject && <p className="truncate text-xs text-muted-foreground">{order.projectName ?? tt("internal")}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          {isSample ? <PainterAvatar painter={painter} /> : <PersonAvatar person={person} />}
          <span className="truncate">{who ?? (isSample ? tt("no_painter") : tt("no_assignee"))}</span>
        </span>
        {order.dueDate && (
          <span className={`flex items-center gap-1 ${late ? "font-medium text-destructive" : ""}`}>
            <CalendarDays className="size-3.5" />
            {late ? `${tt("overdue")} · ` : ""}
            {formatDateCompact(lang, order.dueDate)}
          </span>
        )}
        {isSample && order.samples.length > 0 && (
          <span className="flex items-center gap-1">
            <Palette className="size-3.5" />
            {order.samples.length === 1 ? tt("samples_1") : tt("samples_n", { n: order.samples.length })}
          </span>
        )}
        {!isSample && order.files.length > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="size-3.5" />
            {order.files.length === 1 ? tt("files_1") : tt("files_n", { n: order.files.length })}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Sube archivos de un trabajo: cada uno va directo del navegador a Drive (sin pasar por el servidor) y al final se
 * anotan todos juntos en el trabajo (una sola actualización de la pantalla).
 */
export async function uploadWorkOrderFiles(
  workOrderId: string,
  projectId: string | null,
  original: File[],
  link: { sampleId?: string | null; role?: WorkOrderFile["role"] } = {},
): Promise<{ done: number; failed: { name: string; error: string }[] }> {
  const failed: { name: string; error: string }[] = [];
  const uploaded: { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null; sampleId?: string | null; role?: WorkOrderFile["role"] }[] = [];
  // Las fotos se achican en el teléfono antes de subir (pesan poco y siempre se pueden descargar).
  const files = await Promise.all(original.map((f) => (f.type.startsWith("image/") ? shrinkImage(f) : Promise.resolve(f))));
  for (const file of files) {
    const type = file.type || "application/octet-stream";
    const session = await startWorkOrderUploadAction(workOrderId, file.name, type, file.size);
    if (!session.ok) {
      failed.push({ name: file.name, error: session.error });
      continue;
    }
    try {
      const res = await fetch(session.data, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json().catch(() => null)) as { id?: string } | null;
      if (!json?.id) throw new Error("Drive no devolvió el archivo");
      uploaded.push({ driveFileId: json.id, name: file.name, mimeType: file.type || null, sizeBytes: file.size, sampleId: link.sampleId ?? null, role: link.role ?? "archivo" });
    } catch (err) {
      failed.push({ name: file.name, error: err instanceof Error ? err.message : "Error" });
    }
  }
  if (uploaded.length > 0) {
    const reg = await registerWorkOrderFilesAction(workOrderId, uploaded, projectId);
    if (!reg.ok) return { done: 0, failed: [...failed, ...uploaded.map((u) => ({ name: u.name, error: reg.error }))] };
  }
  return { done: uploaded.length, failed };
}

export function formatSize(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Achica una foto a 1600 px por lado (JPEG ~0.82). Si el navegador no puede, se sube tal cual. */
export async function shrinkImage(file: File, max = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Foto (o inicial) del pintor: miniatura fija en caché. */
export function PainterAvatar({ painter, size = "sm" }: { painter: TallerPainter | undefined; size?: "sm" | "md" }) {
  if (!painter) return null;
  return (
    <ContractorAvatar
      name={painter.name}
      photoUrl={painter.photoPath ? photoUrl("contractor-photos", painter.photoPath, THUMB_WIDTH) : null}
      size={size}
    />
  );
}

/** Miniatura de una foto guardada en Drive (pasa por la app; solo para quien tiene Taller). */
export const driveThumb = (driveFileId: string) => `/api/drive/file/${driveFileId}?thumb=1`;
export const driveFile = (driveFileId: string, download = false) => `/api/drive/file/${driveFileId}${download ? "?download=1" : ""}`;
