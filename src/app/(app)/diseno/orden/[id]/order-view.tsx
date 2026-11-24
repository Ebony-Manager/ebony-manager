"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { FileText, FolderOpen, Hammer, Layers, ListChecks, Plus, Upload, Wrench, X } from "lucide-react";
import { DrivePicker } from "@/app/(app)/diseno/drive-picker";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState, PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { Field, useField } from "@/components/shared/field";
import { FormSection } from "@/components/shared/form-section";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { formatCents } from "@/lib/planilla/payroll-period";
import { laborAmountCents, laborTotals, orderMissing } from "@/lib/produccion/missing";
import { projectPath } from "@/app/(app)/proyectos/paths";
import { driveFile } from "@/app/(app)/diseno/shared";
import {
  EDITABLE_ORDER_STATUSES,
  ORDER_FILE_KINDS,
  REQUIRED_ORDER_FILES,
  type ColorOption,
  type HardwareItemOption,
  type LaborRateOption,
  type OrderFileKind,
  type ProductionOrder,
} from "@/types/produccion";
import type { ProjectItem } from "@/types/diseno";
import {
  addHardwareLineAction,
  addLaborLineAction,
  addMaterialLineAction,
  addOrderFilesAction,
  addOrderItemsAction,
  deleteOrderAction,
  linkOrderFileAction,
  removeOrderFileAction,
  removeOrderItemAction,
  removeOrderLineAction,
  sendOrderAction,
  setItemColorAction,
  startOrderUploadAction,
  withdrawOrderAction,
} from "../actions";
import { OrderStatusBadge, itemsLabel, missingText, useTo, type To } from "../shared";

/** Lo que la ventana de la orden hace después de cada cambio: volver a leer la orden (en la página, nada: la recarga sola). */
export const OrderRefresh = React.createContext<() => void>(() => undefined);

export function OrderView({
  order,
  rates,
  hardwareItems,
  colors,
  freeItems,
  variant = "page",
  onDeleted,
}: {
  order: ProductionOrder;
  rates: LaborRateOption[];
  hardwareItems: HardwareItemOption[];
  colors: ColorOption[];
  freeItems: ProjectItem[];
  /** «dialog»: dentro de la ventana flotante del tablero (sin «volver»). */
  variant?: "page" | "dialog";
  onDeleted?: () => void;
}) {
  const { lang, to } = useTo();
  const router = useRouter();
  const refresh = React.useContext(OrderRefresh);
  const [busy, setBusy] = React.useState(false);
  const [dialog, setDialog] = React.useState<"items" | "labor" | "hardware" | "materials" | null>(null);
  const editable = EDITABLE_ORDER_STATUSES.includes(order.status);
  const missing = orderMissing({ itemCount: order.items.length, fileKinds: order.files.map((f) => f.kind), laborCount: order.labor.length });
  const colorsPending = order.items.filter((i) => !i.color?.trim()).length;
  const colorListId = React.useId();

  async function act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg?: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    if (okMsg) toast.success(okMsg);
    refresh();
    return true;
  }

  async function remove() {
    setBusy(true);
    const res = await deleteOrderAction(order.id);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("deleted"));
    if (onDeleted) onDeleted();
    else router.push(projectPath(res.data, "diseno"));
  }

  const headerAction = 
          order.status === "en_revision" ? (
            <Button variant="outline" disabled={busy} onClick={() => void act(() => withdrawOrderAction(order.id), to("withdrawn"))}>
              {to("withdraw")}
            </Button>
          ) : editable ? (
            <Button disabled={busy || missing.length > 0} onClick={() => void act(() => sendOrderAction(order.id), to("sent"))}>
              {to("send")}
            </Button>
          ) : null;

  const itemName = (id: string | null) => (id ? (order.items.find((i) => i.itemId === id)?.name ?? "—") : to("whole_order"));
  const totals = laborTotals(order.labor);

  return (
    <div className={variant === "page" ? PAGE_CLASS : "flex flex-col gap-5"}>
      {variant === "page" ? (
        <PageHeader
          back={{ href: projectPath(order.projectId, "diseno"), label: order.projectName }}
          title={to("title", { n: order.number })}
          meta={<OrderStatusBadge status={order.status} to={to} />}
          action={headerAction}
        />
      ) : (
        <DialogHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pr-6">
          <div className="min-w-0">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {to("title", { n: order.number })} <OrderStatusBadge status={order.status} to={to} />
            </DialogTitle>
            <DialogDescription>{order.projectName}</DialogDescription>
          </div>
          {headerAction}
        </DialogHeader>
      )}

      {order.status === "por_corregir" && order.reviewNote && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">{to("review_note")}</p>
          <p className="whitespace-pre-line text-foreground">{order.reviewNote}</p>
        </div>
      )}

      {editable ? (
        <div className={`rounded-lg border p-3 text-sm ${missing.length ? "border-border bg-muted/40" : "border-primary/30 bg-primary/5"}`}>
          {missing.length ? (
            <p>
              <span className="font-medium text-foreground">{to("missing_title")}: </span>
              <span className="text-muted-foreground">{missingText(to, missing, lang)}.</span>
            </p>
          ) : (
            <p className="font-medium text-foreground">{to("ready")}</p>
          )}
          {colorsPending > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {to("colors_pending", { n: colorsPending })} · {to("colors_pending_hint")}
            </p>
          )}
        </div>
      ) : (
        order.status === "en_revision" && <p className="text-sm text-muted-foreground">{to("in_review_note")}</p>
      )}

      {/* Ítems y color */}
      <FormSection
        icon={ListChecks}
        title={`${to("sec_items")} · ${itemsLabel(to, order.items.length)}`}
        note={to("sec_items_note")}
        action={
          editable && freeItems.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setDialog("items")}>
              <Plus className="size-3.5" />
              {to("add_items")}
            </Button>
          ) : undefined
        }
      >
        <datalist id={colorListId}>
          {colors.map((c) => (
            <option key={c.label} value={c.label} />
          ))}
        </datalist>
        {order.items.length === 0 ? (
          <EmptyState>{to("no_free_items")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {order.items.map((i) => (
              <li key={i.itemId} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[i.area, i.kind].filter(Boolean).join(" · ")}</p>
                  <p className="flex flex-wrap gap-x-3 text-xs">
                    {i.files.length === 0 ? (
                      <span className="text-muted-foreground">{to("no_item_files")}</span>
                    ) : (
                      i.files.map((f) => (
                        <a key={f.driveFileId} href={driveFile(f.driveFileId)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {f.kind === "medidas" ? to("file_medidas") : to("file_aprobada")}
                        </a>
                      ))
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:w-64">
                  <ColorInput
                    key={`${i.itemId}:${i.color ?? ""}`}
                    listId={colorListId}
                    value={i.color ?? ""}
                    placeholder={to("color_ph")}
                    label={to("f_color")}
                    onSave={(v) => act(() => setItemColorAction(order.id, i.itemId, v), to("color_saved"))}
                  />
                  {editable && (
                    <ConfirmButton
                      iconOnly
                      icon={X}
                      label={to("remove_item")}
                      confirmLabel={to("confirm_remove")}
                      disabled={busy}
                      className="shrink-0 text-muted-foreground"
                      onConfirm={() => void act(() => removeOrderItemAction(order.id, i.itemId))}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {/* Documentos */}
      <FormSection icon={FileText} title={to("sec_docs")}>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {ORDER_FILE_KINDS.map((kind) => (
            <DocRow key={kind} order={order} kind={kind} editable={editable} to={to} />
          ))}
        </ul>
      </FormSection>

      {/* Mano de obra */}
      <FormSection
        icon={Hammer}
        title={to("sec_labor")}
        note={to("sec_labor_note")}
        action={
          editable ? (
            <Button size="sm" variant="outline" onClick={() => setDialog("labor")}>
              <Plus className="size-3.5" />
              {to("add_line")}
            </Button>
          ) : undefined
        }
      >
        {order.labor.length === 0 ? (
          <EmptyState>{to("no_labor")}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
              {order.labor.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {l.description}
                      {l.fase && <span className="font-normal text-muted-foreground"> · {faseLabel(to, l.fase)}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {typeLabel(to, l.contractorType)} · {itemName(l.itemId)} · {l.quantity} {l.unidad} × {formatCents(l.unitPriceCents)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-foreground">{formatCents(laborAmountCents(l))}</span>
                  {editable && (
                    <ConfirmButton
                      iconOnly
                      icon={X}
                      label={to("remove_line")}
                      confirmLabel={to("confirm_remove")}
                      disabled={busy}
                      className="shrink-0 text-muted-foreground"
                      onConfirm={() => void act(() => removeOrderLineAction("production_order_labor", l.id))}
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-x-5 text-sm">
              {[...totals].map(([type, cents]) => (
                <span key={type} className="text-muted-foreground">
                  {to("total_type", { type: typeLabel(to, type) })}: <span className="tabular-nums font-semibold text-foreground">{formatCents(cents)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      {/* Herrajes */}
      <FormSection
        icon={Wrench}
        title={to("sec_hardware")}
        note={to("sec_hardware_note")}
        action={
          editable ? (
            <Button size="sm" variant="outline" onClick={() => setDialog("hardware")}>
              <Plus className="size-3.5" />
              {to("add_line")}
            </Button>
          ) : undefined
        }
      >
        {order.hardware.length === 0 ? (
          <EmptyState>{to("no_hardware")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {order.hardware.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{h.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.source === "inventario" ? to("src_inventario") : to("src_especial")}
                    {h.notes ? ` · ${h.notes}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-foreground">
                  {h.quantity} {h.unit ?? ""}
                </span>
                {editable && (
                  <ConfirmButton
                    iconOnly
                    icon={X}
                    label={to("remove_line")}
                    confirmLabel={to("confirm_remove")}
                    disabled={busy}
                    className="shrink-0 text-muted-foreground"
                    onConfirm={() => void act(() => removeOrderLineAction("production_order_hardware", h.id))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {/* Reserva de material */}
      <FormSection
        icon={Layers}
        title={to("sec_materials")}
        note={to("sec_materials_note")}
        action={
          editable ? (
            <Button size="sm" variant="outline" onClick={() => setDialog("materials")}>
              <Plus className="size-3.5" />
              {to("add_line")}
            </Button>
          ) : undefined
        }
      >
        {order.materials.length === 0 ? (
          <EmptyState>{to("no_materials")}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {order.materials.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{m.material}</p>
                  {m.notes && <p className="truncate text-xs text-muted-foreground">{m.notes}</p>}
                </div>
                <span className="shrink-0 tabular-nums text-foreground">
                  {m.quantity} {m.unit}
                </span>
                {editable && (
                  <ConfirmButton
                    iconOnly
                    icon={X}
                    label={to("remove_line")}
                    confirmLabel={to("confirm_remove")}
                    disabled={busy}
                    className="shrink-0 text-muted-foreground"
                    onConfirm={() => void act(() => removeOrderLineAction("production_order_materials", m.id))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {editable && (
        <div className="flex justify-start border-t border-border pt-3">
          <ConfirmButton className="text-muted-foreground" label={to("delete")} confirmLabel={to("confirm_delete")} disabled={busy} onConfirm={() => void remove()} />
        </div>
      )}

      <AddItemsDialog open={dialog === "items"} orderId={order.id} freeItems={freeItems} onClose={() => setDialog(null)} />
      <LaborDialog open={dialog === "labor"} order={order} rates={rates} onClose={() => setDialog(null)} />
      <HardwareDialog open={dialog === "hardware"} orderId={order.id} items={hardwareItems} onClose={() => setDialog(null)} />
      <MaterialDialog open={dialog === "materials"} orderId={order.id} onClose={() => setDialog(null)} />
    </div>
  );
}

const typeLabel = (to: To, type: string) => (type === "ebanista" ? to("type_ebanista") : type === "pintor" ? to("type_pintor") : type);
const faseLabel = (to: To, fase: string) => (fase === "armado" ? to("fase_armado") : fase === "instalacion" ? to("fase_instalacion") : fase);

/** El color de un ítem: se escribe o se escoge de la lista (muestras del proyecto e historial); se guarda al salir. */
function ColorInput({ value, listId, placeholder, label, onSave }: { value: string; listId: string; placeholder: string; label: string; onSave: (v: string) => Promise<boolean> }) {
  const [v, setV] = React.useState(value);
  const save = () => {
    if (v.trim() === value.trim()) return;
    void onSave(v).then((ok) => !ok && setV(value));
  };
  return (
    <Input
      aria-label={label}
      list={listId}
      value={v}
      placeholder={placeholder}
      className="h-9"
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Un tipo de documento: sus archivos (abrir / quitar) y el botón para subir. */
function DocRow({ order, kind, editable, to }: { order: ProductionOrder; kind: OrderFileKind; editable: boolean; to: To }) {
  const refresh = React.useContext(OrderRefresh);
  const [picking, setPicking] = React.useState(false);

  async function link(driveFileId: string) {
    setPicking(false);
    setUploading(true);
    const res = await linkOrderFileAction(order.id, kind, driveFileId);
    setUploading(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("linked"));
    refresh();
  }
  const ref = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const files = order.files.filter((f) => f.kind === kind);
  const required = REQUIRED_ORDER_FILES.includes(kind);

  async function upload(picked: File[]) {
    if (!picked.length) return;
    setUploading(true);
    const done = [];
    for (const file of picked) {
      const type = file.type || "application/octet-stream";
      const session = await startOrderUploadAction(order.id, file.name, type, file.size);
      if (!session.ok) {
        toast.error(to("upload_failed", { name: file.name, error: session.error }), { duration: 8000 });
        continue;
      }
      try {
        const res = await fetch(session.data, { method: "PUT", headers: { "Content-Type": type }, body: file });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json().catch(() => null)) as { id?: string } | null;
        if (!json?.id) throw new Error("Drive no devolvió el archivo");
        done.push({ driveFileId: json.id, name: file.name, mimeType: file.type || null, sizeBytes: file.size, kind });
      } catch (err) {
        toast.error(to("upload_failed", { name: file.name, error: err instanceof Error ? err.message : "Error" }), { duration: 8000 });
      }
    }
    if (done.length) {
      const res = await addOrderFilesAction(order.id, done);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(to("uploaded"));
        refresh();
      }
    }
    setUploading(false);
  }

  async function removeFile(id: string) {
    const res = await removeOrderFileAction(id);
    if (!res.ok) toast.error(res.error);
    else refresh();
  }

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {to(`doc_${kind}`)}
          {required && <span className="text-destructive"> *</span>}
          {kind === "electricidad" && <span className="block text-xs font-normal text-muted-foreground">{to("doc_electricidad_hint")}</span>}
        </p>
        {editable && (
          <>
            <input
              ref={ref}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                void upload(picked);
              }}
            />
            <Button size="sm" variant="outline" className="h-8" disabled={uploading} onClick={() => setPicking(true)}>
              <FolderOpen className="size-3.5" />
              {to("drive")}
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={uploading} onClick={() => ref.current?.click()}>
              <Upload className="size-3.5" />
              {uploading ? to("uploading") : to("upload")}
            </Button>
            <DrivePicker projectId={order.projectId} open={picking} onPick={(f) => void link(f.id)} onClose={() => setPicking(false)} />
          </>
        )}
      </div>
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <a href={driveFile(f.driveFileId)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">
            {f.name}
          </a>
          {editable && (
            <ConfirmButton iconOnly icon={X} label={to("remove_file")} confirmLabel={to("confirm_remove")} className="shrink-0 text-muted-foreground" onConfirm={() => void removeFile(f.id)} />
          )}
        </div>
      ))}
    </li>
  );
}

/** Agregar a la orden más ítems aprobados del proyecto. */
function AddItemsDialog({ open, orderId, freeItems, onClose }: { open: boolean; orderId: string; freeItems: ProjectItem[]; onClose: () => void }) {
  const refresh = React.useContext(OrderRefresh);
  const { to } = useTo();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"items">();

  /* eslint-disable react-hooks/set-state-in-effect -- limpia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["items", picked.size === 0, to("err_items")]])) return;
    setSaving(true);
    const res = await addOrderItemsAction(orderId, [...picked]);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("saved"));
    refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{to("add_items")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <FormSection icon={ListChecks} title={to("sec_items")} error={error("items")}>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {freeItems.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm select-none">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={picked.has(i.id)}
                      onChange={() => {
                        setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(i.id)) n.delete(i.id);
                          else n.add(i.id);
                          return n;
                        });
                        clear("items");
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{i.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[i.area, i.kind].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </FormSection>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {to("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? to("saving") : to("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ORDER_ALL = "__order__";

/** Una línea de mano de obra: la tarifa, el ítem (o toda la orden) y la cantidad; el monto lo calcula la app. */
function LaborDialog({ open, order, rates, onClose }: { open: boolean; order: ProductionOrder; rates: LaborRateOption[]; onClose: () => void }) {
  const refresh = React.useContext(OrderRefresh);
  const { to } = useTo();
  const [rateId, setRateId] = React.useState("");
  const [itemId, setItemId] = React.useState(ORDER_ALL);
  const [qty, setQty] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"rate" | "qty">();

  /* eslint-disable react-hooks/set-state-in-effect -- limpia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setRateId("");
    setItemId(ORDER_ALL);
    setQty("");
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog } = useDiscardGuard(() => !!rateId || !!qty, onClose);
  const rate = rates.find((r) => r.id === rateId);
  const quantity = Number(qty.replace(",", "."));
  const groups = [...new Set(rates.map((r) => r.contractorType))];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["rate", !rateId, to("err_rate")], ["qty", !(quantity > 0), to("err_quantity")]])) return;
    setSaving(true);
    const res = await addLaborLineAction(order.id, { rateId, itemId: itemId === ORDER_ALL ? null : itemId, quantity });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("saved"));
    refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{to("labor_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={to("f_rate")} required error={error("rate")}>
            <RateSelect
              value={rateId}
              onChange={(v) => {
                setRateId(v);
                clear("rate");
              }}
              rates={rates}
              groups={groups}
              to={to}
            />
          </Field>
          <Field label={to("f_item")}>
            <ItemSelect value={itemId} onChange={setItemId} order={order} to={to} />
          </Field>
          <Field label={rate ? `${to("f_quantity")} (${rate.unidad})` : to("f_quantity")} required error={error("qty")}>
            <Input
              inputMode="decimal"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                clear("qty");
              }}
              placeholder="0"
            />
          </Field>
          {rate && quantity > 0 && (
            <p className="text-right text-sm text-muted-foreground">
              {quantity} × {formatCents(rate.precioCents)} = <span className="font-semibold text-foreground">{formatCents(laborAmountCents({ quantity, unitPriceCents: rate.precioCents }))}</span>
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              {to("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? to("saving") : to("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {dialog}
    </Dialog>
  );
}

function RateSelect({ value, onChange, rates, groups, to }: { value: string; onChange: (v: string) => void; rates: LaborRateOption[]; groups: string[]; to: To }) {
  const field = useField();
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={field?.id} aria-invalid={field?.invalid || undefined} className="w-full">
        <SelectValue placeholder={to("f_rate")} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g) => (
          <SelectGroup key={g}>
            <SelectLabel className="capitalize">{typeLabel(to, g)}</SelectLabel>
            {rates
              .filter((r) => r.contractorType === g)
              .map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.descripcion}
                  {r.fase ? ` · ${faseLabel(to, r.fase)}` : ""} · {formatCents(r.precioCents)}/{r.unidad}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function ItemSelect({ value, onChange, order, to }: { value: string; onChange: (v: string) => void; order: ProductionOrder; to: To }) {
  const field = useField();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={field?.id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ORDER_ALL}>{to("whole_order")}</SelectItem>
        {order.items.map((i) => (
          <SelectItem key={i.itemId} value={i.itemId}>
            {[i.area, i.name].filter(Boolean).join(" · ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Un herraje: del inventario (lo prepara Almacén) o de compra especial. */
function HardwareDialog({ open, orderId, items, onClose }: { open: boolean; orderId: string; items: HardwareItemOption[]; onClose: () => void }) {
  const refresh = React.useContext(OrderRefresh);
  const { to } = useTo();
  const [source, setSource] = React.useState<"inventario" | "especial">("inventario");
  const [itemId, setItemId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"item" | "description" | "qty">();

  /* eslint-disable react-hooks/set-state-in-effect -- limpia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setSource("inventario");
    setItemId("");
    setDescription("");
    setQty("");
    setNotes("");
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog } = useDiscardGuard(() => !!itemId || !!description.trim() || !!qty || !!notes.trim(), onClose);
  const quantity = Number(qty.replace(",", "."));
  const categories = [...new Set(items.map((i) => i.category ?? ""))];
  const unit = source === "inventario" ? items.find((i) => i.id === itemId)?.unit : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !validate([
        ["item", source === "inventario" && !itemId, to("err_inventory_item")],
        ["description", source === "especial" && !description.trim(), to("err_description")],
        ["qty", !(quantity > 0), to("err_quantity")],
      ])
    )
      return;
    setSaving(true);
    const res = await addHardwareLineAction(orderId, {
      source,
      inventoryItemId: source === "inventario" ? itemId : null,
      description,
      quantity,
      unit: unit ?? null,
      notes: notes || null,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("saved"));
    refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{to("hardware_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <SegmentedFilter
            fill
            value={source}
            onChange={(v) => {
              setSource(v);
              clear("item");
              clear("description");
            }}
            options={[
              { value: "inventario" as const, label: to("src_inventario") },
              { value: "especial" as const, label: to("src_especial") },
            ]}
          />
          {source === "inventario" ? (
            <Field label={to("f_inventory_item")} required error={error("item")}>
              <InventorySelect
                value={itemId}
                onChange={(v) => {
                  setItemId(v);
                  clear("item");
                }}
                items={items}
                categories={categories}
                placeholder={to("f_inventory_item")}
              />
            </Field>
          ) : (
            <Field label={to("f_description")} required error={error("description")}>
              <Input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clear("description");
                }}
                placeholder={to("f_description_ph")}
              />
            </Field>
          )}
          <Field label={unit ? `${to("f_quantity")} (${unit})` : to("f_quantity")} required error={error("qty")}>
            <Input
              inputMode="decimal"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                clear("qty");
              }}
              placeholder="0"
            />
          </Field>
          <Field label={to("f_notes")}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              {to("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? to("saving") : to("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {dialog}
    </Dialog>
  );
}

function InventorySelect({
  value,
  onChange,
  items,
  categories,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  items: HardwareItemOption[];
  categories: string[];
  placeholder: string;
}) {
  const field = useField();
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={field?.id} aria-invalid={field?.invalid || undefined} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectGroup key={c}>
            {c && <SelectLabel>{c}</SelectLabel>}
            {items
              .filter((i) => (i.category ?? "") === c)
              .map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Un material que se aparta para la orden. */
function MaterialDialog({ open, orderId, onClose }: { open: boolean; orderId: string; onClose: () => void }) {
  const refresh = React.useContext(OrderRefresh);
  const { to } = useTo();
  const [material, setMaterial] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState("lámina");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"material" | "qty">();

  /* eslint-disable react-hooks/set-state-in-effect -- limpia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMaterial("");
    setQty("");
    setUnit("lámina");
    setNotes("");
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog } = useDiscardGuard(() => !!material.trim() || !!qty || !!notes.trim(), onClose);
  const quantity = Number(qty.replace(",", "."));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["material", !material.trim(), to("err_material")], ["qty", !(quantity > 0), to("err_quantity")]])) return;
    setSaving(true);
    const res = await addMaterialLineAction(orderId, { material, quantity, unit, notes: notes || null });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(to("saved"));
    refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{to("materials_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={to("f_material")} required error={error("material")}>
            <Input
              value={material}
              onChange={(e) => {
                setMaterial(e.target.value);
                clear("material");
              }}
              placeholder={to("f_material_ph")}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <Field label={to("f_quantity")} required error={error("qty")}>
              <Input
                inputMode="decimal"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  clear("qty");
                }}
                placeholder="0"
              />
            </Field>
            <Field label={to("f_unit")}>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
          </div>
          <Field label={to("f_notes")}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              {to("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? to("saving") : to("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {dialog}
    </Dialog>
  );
}
