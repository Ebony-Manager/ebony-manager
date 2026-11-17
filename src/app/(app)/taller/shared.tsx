"use client";

import * as React from "react";
import { CalendarDays, Paperclip } from "lucide-react";

import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { formatDateCompact } from "@/lib/planilla/format";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { THUMB_WIDTH, photoUrl } from "@/lib/photo-url";
import { StatusBadge } from "@/components/shared/status-badge";
import { ContractorAvatar } from "@/app/(app)/contratistas/contractor-avatar";
import type { TallerPerson, WorkOrder, WorkOrderStatus } from "@/types/taller";
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
  tt,
  showProject = true,
  onOpen,
}: {
  order: WorkOrder;
  person: TallerPerson | undefined;
  tt: Tt;
  showProject?: boolean;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  const late = isOverdue(order);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-foreground">{order.title}</p>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tt("kind_cnc")}</span>
      </div>
      {showProject && <p className="truncate text-xs text-muted-foreground">{order.projectName ?? tt("internal")}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <PersonAvatar person={person} />
          <span className="truncate">{person?.name ?? tt("no_assignee")}</span>
        </span>
        {order.dueDate && (
          <span className={`flex items-center gap-1 ${late ? "font-medium text-destructive" : ""}`}>
            <CalendarDays className="size-3.5" />
            {late ? `${tt("overdue")} · ` : ""}
            {formatDateCompact(lang, order.dueDate)}
          </span>
        )}
        {order.files.length > 0 && (
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
  files: File[],
): Promise<{ done: number; failed: { name: string; error: string }[] }> {
  const failed: { name: string; error: string }[] = [];
  const uploaded: { driveFileId: string; name: string; mimeType: string | null; sizeBytes: number | null }[] = [];
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
      uploaded.push({ driveFileId: json.id, name: file.name, mimeType: file.type || null, sizeBytes: file.size });
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
