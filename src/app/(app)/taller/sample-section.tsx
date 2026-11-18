"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Camera, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { needsOfficialCode, type PaintSample, type VeneerType, type WorkOrder, type WorkOrderFile } from "@/types/taller";
import { removeWorkOrderFileAction, setSampleCodeAction } from "./actions";
import { driveFile, driveThumb, uploadWorkOrderFiles, type Tt } from "./shared";

/** Qué le falta a una muestra para quedar lista (vacío = completa). */
export function sampleMissing(order: WorkOrder, s: PaintSample): ("photo" | "code")[] {
  const out: ("photo" | "code")[] = [];
  if (!order.files.some((f) => f.sampleId === s.id && f.role === "resultado")) out.push("photo");
  if (needsOfficialCode(s.kind) && !s.officialCode?.trim()) out.push("code");
  return out;
}

export const sampleReady = (order: WorkOrder) => order.samples.every((s) => sampleMissing(order, s).length === 0);

/**
 * Las muestras de una solicitud en su ficha: cada una con su tipo, sus fotos de referencia y lo que entrega el pintor
 * (la foto terminada y, si es de paleta, el código oficial). Lo puede llenar el pintor o cualquiera con Taller.
 */
export function SampleSection({ order, veneers, tt, busy, setBusy }: { order: WorkOrder; veneers: VeneerType[]; tt: Tt; busy: boolean; setBusy: (b: boolean) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {order.samples.map((s, i) => (
        <SampleCard key={s.id} index={i + 1} order={order} sample={s} veneers={veneers} tt={tt} busy={busy} setBusy={setBusy} />
      ))}
    </div>
  );
}

function SampleCard({
  index,
  order,
  sample,
  veneers,
  tt,
  busy,
  setBusy,
}: {
  index: number;
  order: WorkOrder;
  sample: PaintSample;
  veneers: VeneerType[];
  tt: Tt;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [code, setCode] = React.useState(sample.officialCode ?? "");
  const fileRef = React.useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sigue al valor guardado cuando la pantalla se refresca.
  React.useEffect(() => setCode(sample.officialCode ?? ""), [sample.officialCode]);

  const refs = order.files.filter((f) => f.sampleId === sample.id && f.role === "referencia");
  const results = order.files.filter((f) => f.sampleId === sample.id && f.role === "resultado");
  const missing = sampleMissing(order, sample);
  const veneer = sample.kind === "chapilla" ? veneers.find((v) => v.id === sample.veneerTypeId)?.name : null;
  const wantsCode = needsOfficialCode(sample.kind);
  const codeDirty = code.trim() !== (sample.officialCode ?? "");

  async function saveCode() {
    setBusy(true);
    const res = await setSampleCodeAction(sample.id, code, order.projectId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("code_saved"));
  }

  async function addResult(list: File[]) {
    if (list.length === 0) return;
    setBusy(true);
    const toastId = toast.loading(tt("uploading", { n: list.length }));
    const up = await uploadWorkOrderFiles(order.id, order.projectId, list, { sampleId: sample.id, role: "resultado" });
    toast.dismiss(toastId);
    setBusy(false);
    for (const f of up.failed) toast.error(tt("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    if (up.done > 0) toast.success(tt("uploaded"));
  }

  async function removeFile(f: WorkOrderFile) {
    setBusy(true);
    const res = await removeWorkOrderFileAction(f.id, order.projectId);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            <span className="mr-1.5 text-xs text-muted-foreground">{index}.</span>
            {sample.name}
          </p>
          <p className="text-xs text-muted-foreground">{[tt(`sk_${sample.kind}`), veneer].filter(Boolean).join(" · ")}</p>
        </div>
        {missing.length === 0 ? (
          <Check className="size-4 shrink-0 text-primary" aria-label={tt("status_listo")} />
        ) : (
          order.status !== "cancelado" && (
            <span className="shrink-0 text-right text-xs text-muted-foreground">
              {tt("sample_pending", { what: missing.map((m) => (m === "photo" ? tt("missing_photo") : tt("missing_code"))).join(", ") })}
            </span>
          )
        )}
      </div>

      {refs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{tt("ref_photos")}</p>
          <Thumbs files={refs} removeLabel={tt("remove_file")} confirmLabel={tt("confirm_remove")} busy={busy} onRemove={removeFile} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">{tt("result_photo")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Thumbs files={results} removeLabel={tt("remove_file")} confirmLabel={tt("confirm_remove")} busy={busy} onRemove={removeFile} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addResult(picked);
            }}
          />
          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Camera className="size-3.5" />
            {tt("add_result_photo")}
          </Button>
        </div>
      </div>

      {wantsCode && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`code-${sample.id}`} className="text-xs text-muted-foreground">
            {tt("official_code")}
          </label>
          <div className="flex gap-2">
            <Input
              id={`code-${sample.id}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={tt("official_code_ph")}
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && codeDirty) {
                  e.preventDefault();
                  void saveCode();
                }
              }}
            />
            {codeDirty && (
              <Button size="sm" className="h-9 shrink-0" disabled={busy} onClick={() => void saveCode()}>
                {tt("save")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Miniaturas de fotos guardadas en Drive: tocar abre la foto completa; la X la quita (con confirmación). */
function Thumbs({ files, removeLabel, confirmLabel, busy, onRemove }: { files: WorkOrderFile[]; removeLabel: string; confirmLabel: string; busy: boolean; onRemove: (f: WorkOrderFile) => void }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => (
        <div key={f.id} className="relative">
          <a href={driveFile(f.driveFileId)} target="_blank" rel="noreferrer" title={f.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- la foto pasa por la app (Drive privado) */}
            <img src={driveThumb(f.driveFileId)} alt={f.name} loading="lazy" className="size-20 rounded-md border border-border bg-muted object-cover" />
          </a>
          <ConfirmButton
            iconOnly
            icon={X}
            label={removeLabel}
            confirmLabel={confirmLabel}
            disabled={busy}
            className="absolute -top-2 -right-2 size-6 rounded-full bg-card text-muted-foreground shadow"
            onConfirm={() => onRemove(f)}
          />
        </div>
      ))}
    </div>
  );
}
