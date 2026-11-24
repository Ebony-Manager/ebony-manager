"use client";

import * as React from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Factory, FileText, History, Image as ImageIcon, Pencil, Undo2, X } from "lucide-react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { FormSection } from "@/components/shared/form-section";
import { LoadingBlock } from "@/components/shared/loading-block";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import type { DesignerOption, ItemEvent, ItemFile, ProjectItem } from "@/types/diseno";
import { advanceItemAction, assignItemsAction, deleteItemAction, getItemEventsAction, removeItemFileAction, updateItemAction } from "./actions";
import { DesignerSelect, ItemStageBadge, daysInStage, daysLabel, driveFile, isLate, stageLabel, useTd } from "./shared";
import { StagePanel } from "./stage-panel";
import { STAGE_STEP } from "@/lib/diseno/steps";
import type { OrderSummary } from "@/types/produccion";
import { NewOrderDialog } from "./orden/shared";
import { orderPath } from "./orden/paths";

/**
 * La ficha de un ítem: su etapa y desde cuándo, el paso siguiente en grande, sus archivos (hoja de medidas, fotos,
 * presentaciones por ronda) y el historial. Editar, «área no lista» (en Por medir) y borrar.
 */
export function ItemDialog({
  item,
  onClose,
  names,
  projectHref,
  projectName,
  designers = [],
  siblings = [],
  orders = [],
  onOpenOrder,
}: {
  /** Abrir una orden en su ventana flotante (desde el tablero o la ficha del proyecto). */
  onOpenOrder?: (orderId: string) => void;
  /** Las órdenes de producción del proyecto: un ítem aprobado muestra la suya o el botón para crearla. */
  orders?: OrderSummary[];
  item: ProjectItem | null;
  /** Los ítems del mismo proyecto: el documento de la etapa se puede subir para varios a la vez. */
  siblings?: ProjectItem[];
  onClose: () => void;
  names?: Record<string, string>;
  /** Las diseñadoras del proyecto: para asignar el ítem. */
  designers?: DesignerOption[];
  /** Desde el tablero: el enlace a la ficha del proyecto. */
  projectHref?: string;
  projectName?: string;
}) {
  const { lang, td } = useTd();
  const [busy, setBusy] = React.useState(false);
  const [events, setEvents] = React.useState<ItemEvent[] | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [ordering, setOrdering] = React.useState(false);
  const itemId = item?.id ?? null;
  const key = item ? `${item.stage}:${item.files.length}:${item.name}:${item.designerId}:${item.notes}:${item.waitingClient}` : "";

  React.useEffect(() => {
    if (!itemId) return;
    let alive = true;
    getItemEventsAction(itemId).then((r) => {
      if (alive) setEvents(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [itemId, key]);

  if (!item) return null;
  const late = isLate(item);
  // Los del mismo proyecto en la misma etapa (este primero); marcados de entrada, los de la misma área.
  const sameStage = [item, ...siblings.filter((s) => s.id !== item.id && s.projectId === item.projectId && s.stage === item.stage)];
  const projectOrders = orders.filter((o) => o.projectId === item.projectId);
  const myOrder = projectOrders.find((o) => o.itemIds.includes(item.id));
  const taken = new Set(projectOrders.flatMap((o) => o.itemIds));
  const freeApproved = sameStage.filter((s) => s.stage === "aprobado" && !taken.has(s.id));

  async function go(stepName: "volver") {
    if (!item) return;
    setBusy(true);
    const res = await advanceItemAction(item.id, stepName);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("moved"));
  }

  async function toggleWaiting(v: boolean) {
    if (!item) return;
    setBusy(true);
    const res = await updateItemAction(item.id, item.projectId, { waitingClient: v });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  async function toggleNotReady(v: boolean, nextVisit: string | null) {
    if (!item) return;
    setBusy(true);
    const res = await updateItemAction(item.id, item.projectId, { areaNotReady: v, nextVisit });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  async function assign(designerId: string | null) {
    if (!item) return;
    setBusy(true);
    const res = await assignItemsAction([item.id], item.projectId, designerId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("assigned"));
  }

  async function remove() {
    if (!item) return;
    setBusy(true);
    const res = await deleteItemAction(item.id, item.projectId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("deleted"));
    onClose();
  }

  async function removeFile(f: ItemFile) {
    if (!item) return;
    setBusy(true);
    const res = await removeItemFileAction(f.id, item.projectId);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  const when = (iso: string) => new Date(iso).toLocaleString(lang === "es" ? "es-PA" : "en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const fileLabel = (f: ItemFile) =>
    f.kind === "presentacion" ? td("file_presentacion", { n: f.round || 1 }) : f.kind === "medidas" ? td("file_medidas") : f.kind === "aprobada" ? td("file_aprobada") : td("file_foto");
  const eventText = (e: ItemEvent) =>
    e.kind === "etapa" && e.toStage ? td("ev_etapa", { to: stageLabel(td, e.toStage) }) : e.kind === "archivo" ? td("ev_archivo", { detail: e.detail ?? "" }) : e.kind === "editado" && e.detail ? e.detail : td(`ev_${e.kind}`);
  const who = (id: string | null) => (id && names?.[id]) || td("someone");

  return (
    // ui-allow: sin-campos (la ficha no tiene nada que escribir; editar y los pasos abren su propio formulario)
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,34rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {projectHref && (
              <>
                <Link href={projectHref} className="font-medium text-foreground hover:underline">
                  {projectName ?? td("open_project")}
                </Link>
                {" · "}
              </>
            )}
            {[item.area || td("no_area"), item.kind].filter(Boolean).join(" · ")}
          </p>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <ItemStageBadge stage={item.stage} td={td} />
          {item.round > 0 && <span className="text-muted-foreground">{td("round", { n: item.round })}</span>}
          <span className={late ? "font-medium text-destructive" : "text-muted-foreground"}>
            {late ? `${td("late")} · ` : ""}
            {daysLabel(td, daysInStage(item))}
          </span>
          {item.areaNotReady && <span className="text-muted-foreground">· {td("area_not_ready")}</span>}
          {item.waitingClient && <span className="text-muted-foreground">· {td("waiting_client")}</span>}
        </div>

        {designers.length > 0 && (
          <Field label={td("f_designer")} icon={ICON.designer}>
            <DesignerSelect value={item.designerId} options={designers} disabled={busy} onChange={(v) => void assign(v)} />
          </Field>
        )}

        {/* Lo que se cotizó (material, acabado, herrajes…): viene de la cotización o se escribe al editar. */}
        <FormSection icon={ICON.notes} title={td("notes_title")}>
          {item.notes ? <p className="whitespace-pre-line text-sm text-foreground">{item.notes}</p> : <p className="text-sm text-muted-foreground">{td("no_notes")}</p>}
        </FormSection>

        {item.stage === "aprobado" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            {myOrder ? (
              onOpenOrder ? (
                <Button className="w-full" onClick={() => onOpenOrder(myOrder.id)}>
                  <Factory className="size-4" />
                  {td("open_order", { n: myOrder.number })}
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href={orderPath(myOrder.id)}>
                    <Factory className="size-4" />
                    {td("open_order", { n: myOrder.number })}
                  </Link>
                </Button>
              )
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{td("approved_next")}</p>
                <Button className="w-full" onClick={() => setOrdering(true)}>
                  <Factory className="size-4" />
                  {td("create_order")}
                </Button>
              </>
            )}
          </div>
        )}

        {/* El ida y vuelta con el cliente va por WhatsApp: esta casilla solo dice que la pelota está con el cliente. */}
        {item.stage === "en_diseno" && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
              <input type="checkbox" className="size-4 accent-primary" checked={item.waitingClient} disabled={busy} onChange={(e) => void toggleWaiting(e.target.checked)} />
              {td("waiting_client")}
            </label>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">{td("waiting_client_hint")}</p>
          </div>
        )}

        {item.stage === "por_medir" && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm select-none">
              <input type="checkbox" className="size-4 accent-primary" checked={item.areaNotReady} disabled={busy} onChange={(e) => void toggleNotReady(e.target.checked, item.nextVisit)} />
              {td("area_not_ready")}
            </label>
            {item.areaNotReady && (
              <Field label={td("next_visit")} icon={ICON.date}>
                <Input type="date" defaultValue={item.nextVisit ?? ""} onBlur={(e) => e.target.value !== (item.nextVisit ?? "") && void toggleNotReady(true, e.target.value || null)} />
              </Field>
            )}
          </div>
        )}

        {/* Archivos: arriba, el documento que pide la etapa (se sube aquí, para este y otros ítems) y el paso; abajo, lo cargado. */}
        <FormSection icon={FileText} title={td("files_title")}>
          {STAGE_STEP[item.stage] && (
            <StagePanel
              key={`${item.id}:${item.stage}`}
              items={sameStage}
              defaultChecked={sameStage.filter((s) => s.area.trim() === item.area.trim()).map((s) => s.id)}
            />
          )}
          {item.files.length === 0 ? (
            !STAGE_STEP[item.stage] && <EmptyState>{td("no_files")}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {item.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {f.kind === "foto" ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
                  <a href={driveFile(f.driveFileId)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                    <span className="text-xs text-muted-foreground">{fileLabel(f)} · </span>
                    {f.name}
                  </a>
                  <ConfirmButton iconOnly icon={X} label={td("remove_file")} confirmLabel={td("confirm_remove")} disabled={busy} className="shrink-0 text-muted-foreground" onConfirm={() => void removeFile(f)} />
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection icon={History} title={td("history")}>
          {events === null ? (
            <LoadingBlock rows={3} />
          ) : (
            <ul className="flex flex-col gap-1 text-xs">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-foreground">
                    <span className="font-medium">{e.actorName || who(e.actorId)}</span> · {eventText(e)}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{when(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <ConfirmButton className="text-muted-foreground" label={td("delete")} confirmLabel={td("confirm_delete")} disabled={busy} onConfirm={() => void remove()} />
          <div className="flex flex-wrap gap-2">
            {item.stage !== "por_medir" && item.stage !== "en_produccion" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void go("volver")}>
                <Undo2 className="size-3.5" />
                {td("step_volver")}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              {td("edit")}
            </Button>
          </div>
        </div>
      </DialogContent>
      <EditItemDialog item={editing ? item : null} onClose={() => setEditing(false)} />
      <NewOrderDialog open={ordering} projectId={item.projectId} freeItems={freeApproved} onClose={() => setOrdering(false)} onCreated={onOpenOrder} />
    </Dialog>
  );
}

/** Cambiar área, nombre o tipo del ítem. */
function EditItemDialog({ item, onClose }: { item: ProjectItem | null; onClose: () => void }) {
  const { td } = useTd();
  const [area, setArea] = React.useState("");
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"name">();
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify([area, name, kind, notes]));
  const open = !!item;

  /* eslint-disable react-hooks/set-state-in-effect -- siembra al abrir. */
  React.useEffect(() => {
    if (!item) return;
    reset();
    setArea(item.area);
    setName(item.name);
    setKind(item.kind);
    setNotes(item.notes ?? "");
    markSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog } = useDiscardGuard(isDirty, onClose);
  if (!item) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !validate([["name", !name.trim(), td("err_name")]])) return;
    setSaving(true);
    const res = await updateItemAction(item.id, item.projectId, { area, name, kind, notes });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("saved"));
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{td("edit_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={td("f_area")}>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder={td("f_area_ph")} />
          </Field>
          <Field label={td("f_name")} required error={error("name")}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clear("name");
              }}
              placeholder={td("f_name_ph")}
            />
          </Field>
          <Field label={td("f_kind")}>
            <Input value={kind} onChange={(e) => setKind(e.target.value)} placeholder={td("f_kind_ph")} />
          </Field>
          <Field label={td("f_notes")}>
            <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={td("f_notes_ph")} />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              {td("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? td("saving") : td("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {dialog}
    </Dialog>
  );
}
