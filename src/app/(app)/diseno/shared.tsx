"use client";

import * as React from "react";

import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { StatusBadge } from "@/components/shared/status-badge";
import { useField } from "@/components/shared/field";
import { shrinkImage } from "@/app/(app)/taller/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGE_LATE_DAYS, type DesignerOption, type ItemFileKind, type ItemStage, type ProjectItem } from "@/types/diseno";
import { startItemUploadAction, type UploadedFile } from "./actions";

export type Td = (k: keyof typeof strings.diseno, vars?: Record<string, string | number>) => string;

export function useTd() {
  const { lang } = useLang();
  const td: Td = React.useCallback(
    (k, vars) => {
      let s = t(lang, strings.diseno[k]);
      for (const [key, v] of Object.entries(vars ?? {})) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    [lang],
  );
  return { lang, td };
}

export const stageLabel = (td: Td, s: ItemStage) => td(`stage_${s}`);

export function ItemStageBadge({ stage, td }: { stage: ItemStage; td: Td }) {
  return <StatusBadge status={`item_${stage}`}>{stageLabel(td, stage)}</StatusBadge>;
}

/** Días completos que lleva el ítem en su etapa. */
export function daysInStage(item: Pick<ProjectItem, "stageSince">, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(item.stageSince)) / 86_400_000));
}

/** Atrasado: lleva más de 7 días en la misma etapa de diseño (no cuenta en producción ni con el área sin lista). */
export function isLate(item: Pick<ProjectItem, "stageSince" | "stage" | "areaNotReady">, now = Date.now()): boolean {
  return item.stage !== "en_produccion" && !item.areaNotReady && daysInStage(item, now) > STAGE_LATE_DAYS;
}

export function daysLabel(td: Td, n: number) {
  return n === 0 ? td("today") : n === 1 ? td("day1") : td("days", { n });
}

/** El paso siguiente de cada etapa (botón principal). */
export const NEXT_STEP: Partial<Record<ItemStage, "medido" | "enviar" | "aprobado">> = {
  por_medir: "medido",
  en_diseno: "enviar",
  con_cliente: "aprobado",
};

/**
 * Sube archivos de un ítem: cada uno va directo del navegador a Drive (carpeta del proyecto → MEDIDAS o
 * PRESENTACION) y vuelve listo para anotarlo con la acción. Las fotos se achican antes de subir.
 */
export async function uploadItemFiles(
  projectId: string,
  picked: { file: File; kind: ItemFileKind }[],
): Promise<{ uploaded: UploadedFile[]; failed: { name: string; error: string }[] }> {
  const uploaded: UploadedFile[] = [];
  const failed: { name: string; error: string }[] = [];
  for (const p of picked) {
    const file = p.file.type.startsWith("image/") ? await shrinkImage(p.file) : p.file;
    const type = file.type || "application/octet-stream";
    const session = await startItemUploadAction(projectId, p.kind, file.name, type, file.size);
    if (!session.ok) {
      failed.push({ name: file.name, error: session.error });
      continue;
    }
    try {
      const res = await fetch(session.data, { method: "PUT", headers: { "Content-Type": type }, body: file });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json().catch(() => null)) as { id?: string } | null;
      if (!json?.id) throw new Error("Drive no devolvió el archivo");
      uploaded.push({ driveFileId: json.id, name: file.name, mimeType: file.type || null, sizeBytes: file.size, kind: p.kind });
    } catch (err) {
      failed.push({ name: file.name, error: err instanceof Error ? err.message : "Error" });
    }
  }
  return { uploaded, failed };
}

export const driveFile = (id: string, download = false) => `/api/drive/file/${id}${download ? "?download=1" : ""}`;

const NONE = "__none__";

/** Escoger la diseñadora de un ítem (o de un área) entre las del proyecto; «Sin asignar» la quita. */
export function DesignerSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder,
  className,
  id,
}: {
  value: string | null;
  options: DesignerOption[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const { td } = useTd();
  const field = useField();
  return (
    <Select value={value ?? (placeholder ? undefined : NONE)} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger id={id ?? field?.id} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{td("unassigned")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** El nombre de la diseñadora del ítem, o «Sin asignar». */
export function designerName(td: Td, id: string | null, options: DesignerOption[]): string {
  return (id && options.find((o) => o.id === id)?.name) || td("unassigned");
}

/** Agrupa los ítems por área, en el orden en que aparece cada área. */
export function byArea<T extends Pick<ProjectItem, "area">>(items: T[]): { area: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const i of items) {
    const k = i.area.trim();
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups.entries()].map(([area, list]) => ({ area, items: list }));
}
