"use client";

import * as React from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Download, Plus, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { ListGroupHeader } from "@/components/shared/list-group-header";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import type { DesignerOption, ProjectItem } from "@/types/diseno";
import type { OrderSummary } from "@/types/produccion";
import { orderMissing } from "@/lib/produccion/missing";
import { NewOrderDialog, OrderStatusBadge, itemsLabel, missingText, useTo } from "./orden/shared";
import { orderPath } from "./orden/paths";
import { Factory } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { assignItemsAction, createItemsAction, importQuoteItemsAction } from "./actions";
import { DesignerSelect, ItemStageBadge, NEXT_STEP, daysInStage, daysLabel, designerName, isLate, useTd } from "./shared";
import { ICON } from "@/lib/ui/concepts";
import { ItemDialog } from "./item-dialog";
import { StepDialog, type FileStep } from "./step-dialog";

/** Agrupa los ítems por área, en el orden en que aparece cada área. */
export function byArea<T extends Pick<ProjectItem, "area">>(items: T[]): { area: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const i of items) {
    const k = i.area.trim();
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  return [...groups.entries()].map(([area, list]) => ({ area, items: list }));
}

/**
 * Pestaña «Diseño» de la ficha del proyecto: los ítems (muebles) agrupados por área, cada uno con su etapa, desde
 * cuándo y el botón de su paso siguiente. Se agregan a mano o se traen de la cotización aprobada.
 */
export function ProjectItems({
  projectId,
  items,
  pendingFromQuote,
  designers = [],
  orders = [],
}: {
  projectId: string;
  items: ProjectItem[];
  pendingFromQuote: number;
  /** Las órdenes de producción del proyecto (las de Diseño y las que ya siguieron). */
  orders?: OrderSummary[];
  /** Las diseñadoras del proyecto: con más de una, cada ítem (o área) se asigna a una. */
  designers?: DesignerOption[];
}) {
  const { td } = useTd();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [stepFor, setStepFor] = React.useState<{ id: string; step: FileStep } | null>(null);
  const [importing, setImporting] = React.useState(false);
  const groups = byArea(items);
  const { lang, to } = useTo();
  const [ordering, setOrdering] = React.useState(false);
  const orderOf = new Map(orders.flatMap((o) => o.itemIds.map((id) => [id, o] as const)));
  const freeItems = items.filter((i) => i.stage === "aprobado" && !orderOf.has(i.id));
  const several = designers.length > 1;
  const [assigning, setAssigning] = React.useState(false);

  async function assignArea(ids: string[], designerId: string | null) {
    setAssigning(true);
    const res = await assignItemsAction(ids, projectId, designerId);
    setAssigning(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("assigned"));
  }

  async function importQuote() {
    setImporting(true);
    const res = await importQuoteItemsAction(projectId);
    setImporting(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("imported", { n: res.data }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/diseno">{td("title")}</Link>
        </Button>
        {pendingFromQuote > 0 && (
          <Button size="sm" variant="outline" disabled={importing} onClick={() => void importQuote()}>
            <Download className="size-3.5" />
            {td("import_quote", { n: pendingFromQuote })}
          </Button>
        )}
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          {td("add_item")}
        </Button>
      </div>

      {(orders.length > 0 || freeItems.length > 0) && (
        <FormSection
          icon={Factory}
          title={to("orders")}
          action={
            freeItems.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setOrdering(true)}>
                <Plus className="size-3.5" />
                {to("new_order")}
              </Button>
            ) : undefined
          }
        >
          {orders.length === 0 ? (
            <EmptyState>{to("new_order_desc")}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
              {orders.map((o) => {
                const missing = orderMissing({ itemCount: o.itemIds.length, fileKinds: o.fileKinds, laborCount: o.laborCount });
                const showMissing = (o.status === "borrador" || o.status === "por_corregir") && missing.length > 0;
                return (
                  <li key={o.id}>
                    <Link href={orderPath(o.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{to("title", { n: o.number })}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {itemsLabel(to, o.itemIds.length)}
                          {showMissing && ` · ${to("missing", { list: missingText(to, missing, lang) })}`}
                        </span>
                      </span>
                      <OrderStatusBadge status={o.status} to={to} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </FormSection>
      )}

      {items.length === 0 ? (
        <EmptyState>{td("empty")}</EmptyState>
      ) : (
        groups.map((g) => (
          <div key={g.area} className="flex flex-col gap-1.5">
            {several ? (
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <ListGroupHeader title={g.area || td("no_area")} count={g.items.length} />
                </div>
                {/* Toda el área a una diseñadora de una vez (cada ítem se puede cambiar después). */}
                <DesignerSelect
                  value={null}
                  placeholder={td("assign_area")}
                  options={designers}
                  disabled={assigning}
                  className="h-8 w-40 shrink-0 text-xs"
                  onChange={(v) => void assignArea(g.items.map((i) => i.id), v)}
                />
              </div>
            ) : (
              <ListGroupHeader title={g.area || td("no_area")} count={g.items.length} />
            )}
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
              {g.items.map((i) => {
                const late = isLate(i);
                const next = NEXT_STEP[i.stage];
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                    <button type="button" onClick={() => setOpenId(i.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {i.kind && <span>{i.kind}</span>}
                        <span className={late ? "font-medium text-destructive" : ""}>
                          {late ? `${td("late")} · ` : ""}
                          {daysLabel(td, daysInStage(i))}
                        </span>
                        {i.areaNotReady && <span>· {td("area_not_ready")}</span>}
                        {orderOf.has(i.id) && <span className="font-medium text-foreground">· {to("in_order", { n: orderOf.get(i.id)!.number })}</span>}
                        {several && (
                          <span className={`flex items-center gap-1 ${i.designerId ? "" : "font-medium text-foreground"}`}>
                            · <ICON.designer className="size-3" />
                            {designerName(td, i.designerId, designers)}
                          </span>
                        )}
                      </p>
                    </button>
                    <ItemStageBadge stage={i.stage} td={td} />
                    {next && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setStepFor({ id: i.id, step: next })}>
                        {td(`step_${next}`)}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      <ItemDialog item={items.find((i) => i.id === openId) ?? null} designers={designers} onClose={() => setOpenId(null)} />
      <StepDialog item={stepFor ? (items.find((i) => i.id === stepFor.id) ?? null) : null} step={stepFor?.step ?? null} onClose={() => setStepFor(null)} />
      <NewOrderDialog open={ordering} projectId={projectId} freeItems={freeItems} onClose={() => setOrdering(false)} />
      <AddItemsDialog open={adding} projectId={projectId} designers={several ? designers : []} areas={groups.map((g) => g.area).filter(Boolean)} onClose={() => setAdding(false)} />
    </div>
  );
}

type Row = { key: string; area: string; name: string; kind: string };
const newRow = (area = ""): Row => ({ key: crypto.randomUUID(), area, name: "", kind: "" });

/** Agregar uno o varios ítems de una vez (área, ítem y tipo); el área se repite en el siguiente para ir rápido. */
function AddItemsDialog({
  open,
  projectId,
  areas,
  designers,
  onClose,
}: {
  open: boolean;
  projectId: string;
  areas: string[];
  /** Solo si el proyecto tiene varias: a quién van los ítems nuevos (con una sola, se asignan solos). */
  designers: DesignerOption[];
  onClose: () => void;
}) {
  const { td } = useTd();
  const [rows, setRows] = React.useState<Row[]>([newRow()]);
  const [designerId, setDesignerId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"rows">();
  const listId = React.useId();

  /* eslint-disable react-hooks/set-state-in-effect -- limpia al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setRows([newRow()]);
    setDesignerId(null);
    reset();
  }, [open, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { requestClose, dialog } = useDiscardGuard(() => rows.some((r) => r.name.trim() || r.area.trim() || r.kind.trim()), onClose);
  const patch = (key: string, p: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
    clear("rows");
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const named = rows.filter((r) => r.name.trim());
    if (!validate([["rows", named.length === 0, td("err_name")]])) return;
    setSaving(true);
    const res = await createItemsAction(projectId, named.map((r) => ({ ...r, designerId })));
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(td("saved"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-[min(95vw,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{td("add_items_title")}</DialogTitle>
          <DialogDescription>{td("add_items_desc")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <datalist id={listId}>
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          {rows.map((r, i) => (
            <div key={r.key} className="flex items-start gap-2 rounded-lg border border-border p-3">
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                <Field label={td("f_area")}>
                  <Input list={listId} value={r.area} onChange={(e) => patch(r.key, { area: e.target.value })} placeholder={td("f_area_ph")} />
                </Field>
                <Field label={td("f_name")} required error={i === 0 ? error("rows") : undefined}>
                  <Input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} placeholder={td("f_name_ph")} />
                </Field>
                <Field label={td("f_kind")}>
                  <Input value={r.kind} onChange={(e) => patch(r.key, { kind: e.target.value })} placeholder={td("f_kind_ph")} />
                </Field>
              </div>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={td("delete")}
                  title={td("delete")}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setRows((rs) => [...rs, newRow(rs.at(-1)?.area ?? "")])}>
            <Plus className="size-3.5" />
            {td("add_another")}
          </Button>
          {designers.length > 0 && (
            <Field label={td("f_designer")} icon={ICON.designer}>
              <DesignerSelect value={designerId} options={designers} onChange={setDesignerId} />
            </Field>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              {td("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? td("saving") : td("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {dialog}
    </Dialog>
  );
}
