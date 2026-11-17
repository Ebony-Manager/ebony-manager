"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Ban, CheckCircle2, Download, FileText, History, Paperclip, Pencil, Play, RotateCcw, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState } from "@/components/shared/page-header";
import { FormSection } from "@/components/shared/form-section";
import { LoadingBlock } from "@/components/shared/loading-block";
import { formatDateCompact } from "@/lib/planilla/format";
import { WORK_ORDER_FILE_MAX, type TallerPerson, type WorkOrder, type WorkOrderEvent, type WorkOrderStatus } from "@/types/taller";
import { deleteWorkOrderAction, getWorkOrderEventsAction, removeWorkOrderFileAction, setWorkOrderStatusAction } from "./actions";
import { PersonAvatar, WorkStatusBadge, formatSize, isOverdue, statusLabel, uploadWorkOrderFiles, useTt } from "./shared";

/**
 * La ficha de un trabajo: de qué es, quién lo hace y para cuándo, sus archivos para descargar, el botón grande del
 * paso siguiente (Empezar / Marcar listo / Reabrir) y el historial. Editar y borrar, para quien lo necesite.
 */
export function WorkOrderDetail({
  order,
  people,
  onClose,
  onEdit,
}: {
  order: WorkOrder | null;
  people: TallerPerson[];
  onClose: () => void;
  onEdit: (order: WorkOrder) => void;
}) {
  const { lang, tt } = useTt();
  const [busy, setBusy] = React.useState(false);
  const [events, setEvents] = React.useState<WorkOrderEvent[] | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const orderId = order?.id ?? null;
  const updatedKey = order ? `${order.status}:${order.files.length}:${order.title}` : "";

  // El historial se pide al abrir (y cuando el trabajo cambia), no con la lista.
  React.useEffect(() => {
    if (!orderId) return;
    let alive = true;
    getWorkOrderEventsAction(orderId).then((r) => {
      if (alive) setEvents(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [orderId, updatedKey]);

  if (!order) return null;
  const person = people.find((p) => p.employeeId === order.assigneeId);
  const nameOfUser = (userId: string | null) => (userId ? people.find((p) => p.userId === userId)?.name : undefined) ?? tt("someone");
  const late = isOverdue(order);

  async function setStatus(status: WorkOrderStatus) {
    if (!order) return;
    setBusy(true);
    const res = await setWorkOrderStatusAction(order.id, status, order.projectId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("status_saved"));
  }

  async function remove() {
    if (!order) return;
    setBusy(true);
    const res = await deleteWorkOrderAction(order.id, order.projectId);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tt("deleted"));
    onClose();
  }

  async function addFiles(list: File[]) {
    if (!order || list.length === 0) return;
    setBusy(true);
    const toastId = toast.loading(tt("uploading", { n: list.length }));
    const up = await uploadWorkOrderFiles(order.id, order.projectId, list);
    toast.dismiss(toastId);
    setBusy(false);
    for (const f of up.failed) toast.error(tt("upload_failed", { name: f.name, error: f.error }), { duration: 8000 });
    if (up.done > 0) toast.success(tt("uploaded"));
  }

  async function removeFile(fileId: string) {
    if (!order) return;
    setBusy(true);
    const res = await removeWorkOrderFileAction(fileId, order.projectId);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === "es" ? "es-PA" : "en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const eventText = (e: WorkOrderEvent) => {
    switch (e.kind) {
      case "estado":
        return tt("ev_estado", { to: e.toStatus ? statusLabel(tt, e.toStatus) : "" });
      case "responsable":
        return e.detail ? tt("ev_responsable", { detail: e.detail }) : tt("ev_responsable_none");
      case "archivo_agregado":
        return tt("ev_archivo_agregado", { detail: e.detail ?? "" });
      case "archivo_borrado":
        return tt("ev_archivo_borrado", { detail: e.detail ?? "" });
      default:
        return tt(`ev_${e.kind}`);
    }
  };

  // El paso siguiente, en grande.
  const next =
    order.status === "por_hacer"
      ? { label: tt("start"), icon: Play, to: "en_proceso" as const }
      : order.status === "en_proceso"
        ? { label: tt("finish"), icon: CheckCircle2, to: "listo" as const }
        : { label: tt("reopen"), icon: RotateCcw, to: "por_hacer" as const };

  return (
    // ui-allow: sin-campos (la ficha no tiene nada que escribir; editar abre su propio formulario con aviso)
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,36rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{order.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <WorkStatusBadge status={order.status} tt={tt} />
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tt("kind_cnc")}</span>
          {late && <span className="text-xs font-medium text-destructive">{tt("overdue")}</span>}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label={tt("f_project")} value={order.projectName ?? tt("internal")} />
          <Info
            label={tt("f_assignee")}
            value={
              <span className="flex items-center gap-1.5">
                <PersonAvatar person={person} />
                {person?.name ?? tt("no_assignee")}
              </span>
            }
          />
          <Info label={tt("f_due")} value={order.dueDate ? formatDateCompact(lang, order.dueDate) : "—"} />
          <Info label={tt("requested_by")} value={nameOfUser(order.requestedBy)} />
          {order.startedAt && <Info label={tt("started")} value={when(order.startedAt)} />}
          {order.doneAt && <Info label={tt("finished")} value={when(order.doneAt)} />}
        </dl>

        {order.notes && <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-foreground">{order.notes}</p>}

        {order.status !== "cancelado" && (
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void setStatus(next.to)} variant={order.status === "listo" ? "outline" : "default"}>
            <next.icon className="size-4" />
            {next.label}
          </Button>
        )}

        <FormSection
          icon={Paperclip}
          title={tt("files")}
          action={
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  void addFiles(picked);
                }}
              />
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
                {tt("add_files")}
              </Button>
            </>
          }
        >
          {order.files.length === 0 ? (
            <EmptyState>{tt("no_files")}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {order.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.sizeBytes)}</span>
                  {(f.sizeBytes ?? 0) <= WORK_ORDER_FILE_MAX && (
                    <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs">
                      <a href={`/api/drive/file/${f.driveFileId}?download=1`} download={f.name}>
                        <Download className="size-3.5" />
                        {tt("download")}
                      </a>
                    </Button>
                  )}
                  <ConfirmButton
                    iconOnly
                    icon={X}
                    label={tt("remove_file")}
                    confirmLabel={tt("confirm_remove")}
                    disabled={busy}
                    className="shrink-0 text-muted-foreground"
                    onConfirm={() => void removeFile(f.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection icon={History} title={tt("history")}>
          {events === null ? (
            <LoadingBlock rows={3} />
          ) : (
            <ul className="flex flex-col gap-1 text-xs">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-foreground">
                    <span className="font-medium">{nameOfUser(e.actorId)}</span> · {eventText(e)}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{when(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <ConfirmButton className="text-muted-foreground" label={tt("delete")} confirmLabel={tt("confirm_delete")} disabled={busy} onConfirm={() => void remove()} />
          <div className="flex flex-wrap gap-2">
            {(order.status === "por_hacer" || order.status === "en_proceso") && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("cancelado")}>
                <Ban className="size-3.5" />
                {tt("cancel_job")}
              </Button>
            )}
            {order.status === "cancelado" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("por_hacer")}>
                <RotateCcw className="size-3.5" />
                {tt("reopen")}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(order)}>
              <Pencil className="size-3.5" />
              {tt("edit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}
