"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { CircleCheck, Factory, Upload } from "lucide-react";
import { NewOrderDialog } from "./orden/shared";
import { FileDropZone } from "@/components/shared/file-drop-zone";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STAGE_STEP, STEP_FILE, hasStepFile, stepFiles, type FileStep } from "@/lib/diseno/steps";
import type { ProjectItem } from "@/types/diseno";
import { advanceItemsAction, attachStepFileAction, linkStepFileAction } from "./actions";
import { DrivePicker } from "./drive-picker";
import { FolderOpen } from "lucide-react";
import { byArea, stageLabel, uploadItemFiles, useTd } from "./shared";

/**
 * El documento que pide la etapa (hoja de medidas, presentación o presentación aprobada), para uno o varios
 * ítems del mismo proyecto que están en la misma etapa: se sube una vez y queda en todos los marcados. El
 * botón del paso (Medido, Enviar al cliente, Cliente aprobó) se habilita cuando todos tienen su documento.
 */
export function StagePanel({ items, defaultChecked, onOpenItem }: { items: ProjectItem[]; defaultChecked: string[]; onOpenItem?: (id: string) => void }) {
  const { td } = useTd();
  const step = items[0] ? STAGE_STEP[items[0].stage] : undefined;
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(defaultChecked));
  const [busy, setBusy] = React.useState(false);
  // A quién va el archivo: a todos los marcados, o a un ítem solo (su propia hoja).
  const [picking, setPicking] = React.useState<false | "all" | string>(false);
  const [uploadFor, setUploadFor] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
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

  const docLabel = step === "medido" ? td("f_medidas") : td("f_aprobada");
  const desc = step === "medido" ? td("dlg_medido_desc") : td("dlg_aprobado_desc");
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

  async function upload(file: File, only?: string) {
    const targets = only ? items.filter((i) => i.id === only) : picked;
    if (!step || targets.length === 0) return void toast.error(td("err_pick_items"));
    setBusy(true);
    const up = await uploadItemFiles(targets[0].projectId, [{ file, kind: STEP_FILE[step] }]);
    for (const f of up.failed) toast.error(td("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    if (up.uploaded[0]) {
      const res = await attachStepFileAction(
        targets.map((i) => i.id),
        step,
        up.uploaded[0],
      );
      if (!res.ok) toast.error(res.error);
      else toast.success(td("doc_uploaded"));
    }
    setBusy(false);
  }

  async function linkFromDrive(driveFileId: string) {
    const targets = picking && picking !== "all" ? items.filter((i) => i.id === picking) : picked;
    if (!step || targets.length === 0) return void toast.error(td("err_pick_items"));
    setPicking(false);
    setBusy(true);
    const res = await linkStepFileAction(
      targets.map((i) => i.id),
      step,
      driveFileId,
    );
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("linked_ok"));
  }

  async function advance(s: FileStep) {
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

      {several && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{td("for_items")}</p>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept="application/pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && uploadFor) void upload(f, uploadFor);
              setUploadFor(null);
            }}
          />
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
                {g.items.map((i) => {
                  const own = stepFiles(i, step);
                  return (
                    <div key={i.id} className="flex items-center gap-2 py-0.5 text-sm">
                      <input
                        type="checkbox"
                        aria-label={i.name}
                        className="size-4 shrink-0 accent-primary"
                        checked={checked.has(i.id)}
                        disabled={busy}
                        onChange={(e) => toggle([i.id], e.target.checked)}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        {onOpenItem ? (
                          <button type="button" className="truncate text-left hover:underline" onClick={() => onOpenItem(i.id)}>
                            {i.name}
                          </button>
                        ) : (
                          <span className="truncate">{i.name}</span>
                        )}
                        <span className={`truncate text-xs ${own.length ? "text-primary" : "text-muted-foreground"}`}>
                          {own.length ? `✓ ${own.map((f) => f.name).join(", ")}` : td("doc_missing_short")}
                        </span>
                      </span>
                      {/* Solo la hoja de medidas es de cada ítem; la presentación (y lo demás) es del bloque entero. */}
                      {step === "medido" && (
                        <>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label={td("upload_own")}
                        title={td("upload_own")}
                        disabled={busy}
                        onClick={() => {
                          setUploadFor(i.id);
                          inputRef.current?.click();
                        }}
                      >
                        <Upload className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label={td("pick_own")}
                        title={td("pick_own")}
                        disabled={busy}
                        onClick={() => setPicking(i.id)}
                      >
                        <FolderOpen className="size-3.5" />
                      </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Un mismo archivo para todos los marcados (la presentación del bloque; o una hoja que sirve a todos). */}
      <FileDropZone
        accept="application/pdf,image/*"
        label={docs.length ? td("drop_again") : td(step === "medido" ? "drop_medidas" : "drop_aprobada")}
        busy={busy}
        busyLabel={td("uploading")}
        disabled={n === 0}
        onFiles={(files) => void upload(files[0])}
      />
      {/* Si el archivo ya está en el Drive del proyecto, se escoge de ahí: no se sube otra copia. */}
      <p className="-mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
        {td("or_drive")}
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={busy || n === 0} onClick={() => setPicking("all")}>
          <FolderOpen className="size-3.5" />
          {td("pick_drive")}
        </Button>
      </p>
      {items[0] && <DrivePicker projectId={items[0].projectId} open={!!picking} onPick={(f) => void linkFromDrive(f.id)} onClose={() => setPicking(false)} />}

      {docs.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-foreground">
          <CircleCheck className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{docs.map((f) => f.name).join(", ")}</span>
        </p>
      )}
      {missing.length > 0 && docs.length > 0 && <p className="text-xs text-muted-foreground">{td("missing_doc", { names: missing.map((i) => i.name).join(", ") })}</p>}

      <Button type="button" className="w-full" disabled={busy || n === 0 || missing.length > 0} onClick={() => void advance(step)}>
        {td(`step_${step}`)}
        {n > 1 ? ` (${n})` : ""}
      </Button>
    </div>
  );
}

/**
 * Un bloque del tablero (lo que se trabaja y avanza junto): sus ítems con sus documentos y el paso. En Aprobado, el
 * botón para crear su orden de producción.
 */
export function BlockDialog({
  items,
  title,
  projectName,
  onOpenItem,
  onOpenOrder,
  onClose,
}: {
  items: ProjectItem[] | null;
  title: string;
  projectName: string;
  onOpenItem: (id: string) => void;
  onOpenOrder: (orderId: string) => void;
  onClose: () => void;
}) {
  const { td } = useTd();
  const [ordering, setOrdering] = React.useState(false);
  if (!items || items.length === 0) return null;
  const step = STAGE_STEP[items[0].stage];
  return (
    // ui-allow: sin-campos (el panel sube un archivo y mueve los ítems; no hay nada que escribir)
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {projectName} · {td("items_n", { n: items.length })} · {stageLabel(td, items[0].stage)}
          </DialogDescription>
        </DialogHeader>
        {step ? (
          <StagePanel items={items} defaultChecked={items.map((i) => i.id)} onOpenItem={onOpenItem} />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {items.map((i) => (
                <li key={i.id}>
                  <button type="button" className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted/40" onClick={() => onOpenItem(i.id)}>
                    <span className="font-medium text-foreground">{i.name}</span>
                    <span className="text-xs text-muted-foreground">{[i.area, i.kind].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
            {items[0].stage === "aprobado" && (
              <>
                <p className="text-sm text-muted-foreground">{td("approved_next")}</p>
                <Button className="w-full" onClick={() => setOrdering(true)}>
                  <Factory className="size-4" />
                  {td("create_order")}
                </Button>
                <NewOrderDialog
                  open={ordering}
                  projectId={items[0].projectId}
                  freeItems={items}
                  onClose={() => setOrdering(false)}
                  onCreated={(id) => {
                    setOrdering(false);
                    onOpenOrder(id);
                  }}
                />
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
