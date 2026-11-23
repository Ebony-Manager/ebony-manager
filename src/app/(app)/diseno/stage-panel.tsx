"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { FileText, RotateCcw, Upload } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STAGE_STEP, STEP_FILE, hasStepFile, stepFiles, type FileStep } from "@/lib/diseno/steps";
import type { ProjectItem } from "@/types/diseno";
import { advanceItemsAction, attachStepFileAction } from "./actions";
import { byArea, driveFile, uploadItemFiles, useTd } from "./shared";

/**
 * El documento que pide la etapa (hoja de medidas, presentación o presentación aprobada), para uno o varios
 * ítems del mismo proyecto que están en la misma etapa: se sube una vez y queda en todos los marcados. El
 * botón del paso (Medido, Enviar al cliente, Cliente aprobó) se habilita cuando todos tienen su documento.
 */
export function StagePanel({ items, defaultChecked }: { items: ProjectItem[]; defaultChecked: string[] }) {
  const { td } = useTd();
  const step = items[0] ? STAGE_STEP[items[0].stage] : undefined;
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(defaultChecked));
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  const ids = items.map((i) => i.id).join(",");

  // Si la lista cambia (un ítem avanzó), se quitan los que ya no están.
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza con la lista. */
  React.useEffect(() => {
    setChecked((s) => new Set([...s].filter((id) => items.some((i) => i.id === id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!step) return null;
  const picked = items.filter((i) => checked.has(i.id));
  const missing = picked.filter((i) => !hasStepFile(i, step));
  // Los documentos ya cargados en los marcados (uno por archivo de Drive).
  const docs = [...new Map(picked.flatMap((i) => stepFiles(i, step)).map((f) => [f.driveFileId, f])).values()];
  const groups = byArea(items);
  const several = items.length > 1;

  const docLabel = step === "medido" ? td("f_medidas") : step === "enviar" ? td("f_presentacion") : td("f_aprobada");
  const desc = step === "medido" ? td("dlg_medido_desc") : step === "enviar" ? td("dlg_enviar_desc") : td("dlg_aprobado_desc");
  const n = picked.length;

  function toggle(idsToToggle: string[], on: boolean) {
    setChecked((s) => {
      const next = new Set(s);
      for (const id of idsToToggle) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function upload(file: File) {
    if (!step || picked.length === 0) return void toast.error(td("err_pick_items"));
    setBusy(true);
    const up = await uploadItemFiles(picked[0].projectId, [{ file, kind: STEP_FILE[step] }]);
    for (const f of up.failed) toast.error(td("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    if (up.uploaded[0]) {
      const res = await attachStepFileAction(
        picked.map((i) => i.id),
        step,
        up.uploaded[0],
      );
      if (!res.ok) toast.error(res.error);
      else toast.success(td("doc_uploaded"));
    }
    setBusy(false);
  }

  async function advance(s: FileStep | "cambios") {
    if (picked.length === 0) return void toast.error(td("err_pick_items"));
    setBusy(true);
    const res = await advanceItemsAction(
      picked.map((i) => i.id),
      s,
    );
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("moved"));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          {docLabel} <span className="text-destructive">*</span>
        </p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>

      {docs.map((f) => (
        <a key={f.driveFileId} href={driveFile(f.driveFileId)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
          <FileText className="size-4 shrink-0" />
          <span className="truncate">{f.name}</span>
        </a>
      ))}

      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {several && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{td("for_items")}</p>
          {groups.map((g) => {
            const areaIds = g.items.map((i) => i.id);
            const all = areaIds.every((id) => checked.has(id));
            return (
              <div key={g.area} className="flex flex-col gap-0.5">
                {groups.length > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{g.area || td("no_area")}</span>
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => toggle(areaIds, !all)}>
                      {td("whole_area")}
                    </button>
                  </div>
                )}
                {g.items.map((i) => (
                  <label key={i.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm select-none">
                    <input type="checkbox" className="size-4 accent-primary" checked={checked.has(i.id)} disabled={busy} onChange={(e) => toggle([i.id], e.target.checked)} />
                    <span className="min-w-0 flex-1 truncate">{i.name}</span>
                    {hasStepFile(i, step) && <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {missing.length > 0 && docs.length > 0 && <p className="text-xs text-muted-foreground">{td("missing_doc", { names: missing.map((i) => i.name).join(", ") })}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || n === 0} onClick={() => ref.current?.click()}>
          <Upload className="size-4" />
          {busy ? td("uploading") : docs.length ? td("replace_doc") : td("upload_doc")}
        </Button>
        <Button type="button" className="flex-1" disabled={busy || n === 0 || missing.length > 0} onClick={() => void advance(step)}>
          {td(`step_${step}`)}
          {n > 1 ? ` (${n})` : ""}
        </Button>
      </div>
      {step === "aprobado" && (
        <Button type="button" variant="ghost" size="sm" className="self-start" disabled={busy || n === 0} onClick={() => void advance("cambios")}>
          <RotateCcw className="size-3.5" />
          {td("step_cambios")}
          {n > 1 ? ` (${n})` : ""}
        </Button>
      )}
    </div>
  );
}

/** El mismo panel para un grupo (los ítems de un proyecto en una columna del tablero). */
export function StageGroupDialog({ items, title, onClose }: { items: ProjectItem[] | null; title: string; onClose: () => void }) {
  const { td } = useTd();
  if (!items || items.length === 0) return null;
  const step = STAGE_STEP[items[0].stage];
  return (
    // ui-allow: sin-campos (el panel sube un archivo y mueve los ítems; no hay nada que escribir)
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step ? td(`step_${step}`) : ""} · {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <StagePanel items={items} defaultChecked={items.map((i) => i.id)} />
      </DialogContent>
    </Dialog>
  );
}
