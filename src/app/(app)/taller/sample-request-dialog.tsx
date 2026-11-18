"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ImagePlus, Palette, Plus, Trash2, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { nextSampleSaturday } from "@/lib/taller/sample-date";
import { SearchPicker } from "@/app/(app)/contratistas/search-picker";
import { PAINT_SAMPLE_KINDS, type PaintSampleKind, type TallerPainter, type TallerProject, type VeneerType, type WorkOrder } from "@/types/taller";
import { saveSampleRequestAction } from "./actions";
import { uploadWorkOrderFiles, useTt } from "./shared";

interface Line {
  key: string;
  id: string | null;
  name: string;
  kind: PaintSampleKind;
  veneerTypeId: string | null;
  /** Fotos de referencia nuevas (se suben al guardar). */
  photos: File[];
}

const newLine = (): Line => ({ key: crypto.randomUUID(), id: null, name: "", kind: "sherwin_williams", veneerTypeId: null, photos: [] });

/**
 * Pedir (o editar) una muestra de pintura: proyecto, para cuándo (el sábado que toca; se puede cambiar), el pintor
 * del turno (marcado; se puede cambiar), notas y una o varias muestras con su nombre, tipo, chapilla y fotos de
 * referencia. Al crearla, al pintor le llega un correo.
 */
export function SampleRequestDialog({
  open,
  onOpenChange,
  order,
  painters,
  veneers,
  projects,
  defaultProjectId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrder | null;
  painters: TallerPainter[];
  veneers: VeneerType[];
  projects: TallerProject[];
  defaultProjectId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const { tt } = useTt();
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [contractorId, setContractorId] = React.useState<string | null>(null);
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([newLine()]);
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"project" | "samples">();

  const snapshot = () =>
    JSON.stringify([projectId, contractorId, dueDate, notes, lines.map((l) => [l.name, l.kind, l.veneerTypeId, l.photos.length])]);
  const { isDirty, markSeeded } = useFormBaseline(snapshot);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir. */
  React.useEffect(() => {
    if (!open) return;
    reset();
    setProjectId(order ? order.projectId : (defaultProjectId ?? null));
    setContractorId(order ? order.assigneeContractorId : (painters.find((p) => p.turnRank === 1)?.contractorId ?? null));
    setDueDate(order ? (order.dueDate ?? "") : nextSampleSaturday(todayInPanama()));
    setNotes(order?.notes ?? "");
    setLines(
      order && order.samples.length
        ? order.samples.map((x) => ({ key: x.id, id: x.id, name: x.name, kind: x.kind, veneerTypeId: x.veneerTypeId, photos: [] }))
        : [newLine()],
    );
    markSeeded();
  }, [open, order, defaultProjectId, painters, reset, markSeeded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, () => onOpenChange(false));

  const painter = painters.find((p) => p.contractorId === contractorId);
  const project = projects.find((p) => p.id === projectId);
  const activeVeneers = veneers.filter((v) => v.active);
  const setLine = (key: string, patch: Partial<Line>) => {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    clear("samples");
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const named = lines.filter((l) => l.name.trim());
    if (
      !validate([
        ["project", !projectId, tt("err_project")],
        ["samples", named.length === 0, tt("err_samples")],
        ["samples", named.some((l) => l.kind === "chapilla" && !l.veneerTypeId), tt("err_veneer")],
      ])
    )
      return;
    setSaving(true);
    const res = await saveSampleRequestAction(
      order?.id ?? null,
      { projectId, contractorId, dueDate: dueDate || null, notes, samples: named.map((l) => ({ id: l.id, name: l.name, kind: l.kind, veneerTypeId: l.veneerTypeId })) },
      order ? { projectId: order.projectId, contractorId: order.assigneeContractorId } : undefined,
    );
    if (!res.ok) {
      setSaving(false);
      return void toast.error(res.error);
    }
    // Las fotos de referencia de las muestras nuevas (en el mismo orden en que se guardaron).
    const newLines = named.filter((l) => !l.id);
    for (const [i, l] of newLines.entries()) {
      const sampleId = res.data.newSampleIds[i];
      if (!sampleId || l.photos.length === 0) continue;
      const up = await uploadWorkOrderFiles(res.data.id, projectId, l.photos, { sampleId, role: "referencia" });
      for (const f of up.failed) toast.error(tt("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    }
    setSaving(false);
    if (res.data.emailWarning) toast(tt("email_warning", { error: res.data.emailWarning }), { duration: 8000 });
    toast.success(order ? tt("saved") : tt("created"));
    onOpenChange(false);
    onSaved?.(res.data.id);
  }

  const kindLabel = (k: PaintSampleKind) => tt(`sk_${k}`);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? order.title : tt("new_sample_title")}</DialogTitle>
          <DialogDescription>{tt("kind_muestra")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={tt("f_project")} icon={ICON.project} required error={error("project")}>
              <SearchPicker
                triggerLabel={project?.name ?? tt("f_project")}
                searchPlaceholder={tt("f_project")}
                emptyText={tt("no_results")}
                groups={[{ options: projects.filter((p) => p.active || p.id === projectId).map((p) => ({ id: p.id, label: p.name })) }]}
                onSelect={(id) => {
                  setProjectId(id);
                  clear("project");
                }}
              />
            </Field>
            <Field label={tt("f_painter")} icon={ICON.owner} hint={painter && !painter.hasEmail ? tt("painter_no_email") : undefined}>
              <SearchPicker
                triggerLabel={painter ? `${painter.name}${painter.turnRank === 1 ? ` · ${tt("painter_turn")}` : ""}` : tt("no_painter")}
                searchPlaceholder={tt("f_painter")}
                emptyText={tt("no_results")}
                noneLabel={tt("no_painter")}
                groups={[{ options: painters.map((p) => ({ id: p.contractorId, label: p.turnRank === 1 ? `${p.name} · ${tt("painter_turn")}` : p.name })) }]}
                onSelect={setContractorId}
              />
            </Field>
            <Field label={tt("f_due")} icon={ICON.date} hint={order ? undefined : tt("f_due_sample_hint")}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>

          <FormSection icon={Palette} title={tt("samples")} error={error("samples")}>
            <div className="flex flex-col gap-3">
              {lines.map((l, i) => (
                <div key={l.key} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label={tt("sample_name")}>
                        <Input value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder={tt("sample_name_ph")} />
                      </Field>
                      <Field label={tt("sample_kind")}>
                        <Select value={l.kind} onValueChange={(v) => setLine(l.key, { kind: v as PaintSampleKind })}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAINT_SAMPLE_KINDS.map((k) => (
                              <SelectItem key={k} value={k}>
                                {kindLabel(k)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      {l.kind === "chapilla" && (
                        <Field label={tt("veneer_type")}>
                          <Select value={l.veneerTypeId ?? ""} onValueChange={(v) => setLine(l.key, { veneerTypeId: v })}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={tt("pick_veneer")} />
                            </SelectTrigger>
                            <SelectContent>
                              {activeVeneers.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </div>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        title={tt("remove_sample")}
                        onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  {!l.id && <PhotoPicker files={l.photos} onChange={(photos) => setLine(l.key, { photos })} label={tt("ref_photos")} addLabel={tt("add_photos")} removeLabel={tt("remove_file")} />}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLines((cur) => [...cur, newLine()])}>
                <Plus className="size-3.5" />
                {tt("add_sample")}
              </Button>
            </div>
          </FormSection>

          <Field label={tt("f_notes")}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {tt("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? tt("saving") : order ? tt("save") : tt("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}

/** Elegir fotos (de la cámara o la galería) con su vista previa y una X para quitarlas. */
function PhotoPicker({ files, onChange, label, addLabel, removeLabel }: { files: File[]; onChange: (files: File[]) => void; label: string; addLabel: string; removeLabel: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const urls = React.useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  React.useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob) */}
            <img src={u} alt="" className="size-16 rounded-md border border-border object-cover" />
            <button
              type="button"
              aria-label={removeLabel}
              title={removeLabel}
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-card text-muted-foreground shadow"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onChange([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {/* ui-allow: foto (botón de agregar foto) */}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:bg-muted/40"
        >
          <ImagePlus className="size-4" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
