"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { FileUp, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, useField } from "@/components/shared/field";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import type { ItemFileKind, ProjectItem } from "@/types/diseno";
import { advanceItemAction } from "./actions";
import { uploadItemFiles, useTd } from "./shared";

export type FileStep = "medido" | "enviar" | "aprobado";

const MAIN_KIND: Record<FileStep, ItemFileKind> = { medido: "medidas", enviar: "presentacion", aprobado: "aprobada" };

/**
 * El paso que pide archivo: «Medido» (la hoja de medidas; fotos opcionales), «Enviar al cliente» (la presentación
 * enviada) y «Cliente aprobó» (la presentación aprobada). Sube a Drive y mueve el ítem a su etapa siguiente.
 */
export function StepDialog({ item, step, onClose }: { item: ProjectItem | null; step: FileStep | null; onClose: () => void }) {
  const { td } = useTd();
  const [main, setMain] = React.useState<File | null>(null);
  const [photos, setPhotos] = React.useState<File[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"main">();
  const open = !!item && !!step;

  /* eslint-disable react-hooks/set-state-in-effect -- limpia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMain(null);
    setPhotos([]);
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => !!main || photos.length > 0, onClose);
  if (!item || !step) return null;

  const title = td(`step_${step}`);
  const desc = step === "medido" ? td("dlg_medido_desc") : step === "enviar" ? td("dlg_enviar_desc") : td("dlg_aprobado_desc");
  const mainLabel = step === "medido" ? td("f_medidas") : step === "enviar" ? td("f_presentacion") : td("f_aprobada");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !step) return;
    if (!validate([["main", !main, td("err_file")]])) return;
    setSaving(true);
    const picked = [{ file: main as File, kind: MAIN_KIND[step] }, ...photos.map((file) => ({ file, kind: "foto" as const }))];
    const up = await uploadItemFiles(item.projectId, picked);
    for (const f of up.failed) toast.error(td("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    if (!up.uploaded.some((u) => u.kind === MAIN_KIND[step])) return void setSaving(false);
    const res = await advanceItemAction(item.id, step, up.uploaded);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("moved"));
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title} · {item.name}
          </DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={mainLabel} required error={error("main")}>
            <FilePick
              files={main ? [main] : []}
              accept={step === "medido" ? "application/pdf,image/*" : "application/pdf,image/*"}
              label={td("pick_file")}
              removeLabel={td("remove_file")}
              onChange={(f) => {
                setMain(f[0] ?? null);
                clear("main");
              }}
            />
          </Field>
          {step === "medido" && (
            <Field label={td("f_fotos")}>
              <FilePick files={photos} multiple accept="image/*" label={td("pick_files")} removeLabel={td("remove_file")} onChange={setPhotos} />
            </Field>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              {td("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? td("uploading") : title}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}

/** Elegir uno o varios archivos: botón y la lista de lo elegido con su X. */
export function FilePick({
  files,
  multiple = false,
  accept,
  label,
  removeLabel,
  onChange,
}: {
  files: File[];
  multiple?: boolean;
  accept?: string;
  label: string;
  removeLabel: string;
  onChange: (files: File[]) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const field = useField();
  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
        }}
      />
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <button type="button" aria-label={removeLabel} title={removeLabel} className="text-muted-foreground hover:text-foreground" onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {(multiple || files.length === 0) && (
        <Button
          id={field?.id}
          aria-invalid={field?.invalid || undefined}
          type="button"
          variant="outline"
          size="sm"
          className="self-start aria-[invalid=true]:border-destructive"
          onClick={() => ref.current?.click()}
        >
          <FileUp className="size-3.5" />
          {label}
        </Button>
      )}
    </div>
  );
}
