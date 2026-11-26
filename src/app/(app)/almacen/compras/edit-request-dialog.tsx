"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { ExternalLink } from "lucide-react";

import { INVENTORY_UNITS, type InventoryUnit, type PurchaseRequest } from "@/types/almacen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { parseQty } from "@/lib/almacen/inventory";
import { editPurchaseRequestAction } from "../actions";
import { Combo, QtyInput, useTa } from "../shared";

type Project = { id: string; name: string; active: boolean };

/** Quién puede editar una solicitud: pendiente, y quien la pidió o Compras. */
export const RequestEditContext = React.createContext<{ canEdit: (r: PurchaseRequest) => boolean; edit: (r: PurchaseRequest) => void } | null>(null);

/**
 * Las notas de una solicitud (motivo, medidas, el link de Amazon): los enlaces se pueden tocar.
 * Un link largo se muestra como «link» para no llenar la fila.
 */
export function RequestNotes({ text, className }: { text: string | null; className?: string }) {
  const { ta } = useTa();
  if (!text?.trim()) return null;
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <span className={`block break-words text-xs text-muted-foreground ${className ?? ""}`}>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            {ta("link_open")}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </span>
  );
}

/** Editar una solicitud pendiente: qué es (si es texto libre), cantidad, proyecto y notas/link. */
export function EditRequestDialog({ request, projects, onClose }: { request: PurchaseRequest | null; projects: Project[]; onClose: () => void }) {
  const { ta } = useTa();
  const free = !!request && !request.variantId;
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState<InventoryUnit>("unidad");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"what" | "qty" | "project">();
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify({ description, qty, unit, projectId, notes }));
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- los datos de la solicitud al abrir. */
  React.useEffect(() => {
    if (!request) return;
    setDescription(request.description);
    setQty(String(request.qty));
    setUnit((INVENTORY_UNITS as readonly string[]).includes(request.unit ?? "") ? (request.unit as InventoryUnit) : "unidad");
    setProjectId(request.projectId);
    setNotes(request.reason ?? "");
    setSaving(false);
    reset();
    markSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [request]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const projectOptions = React.useMemo(
    () => projects.filter((p) => p.active || p.id === projectId).map((p) => ({ value: p.id, label: p.name })),
    [projects, projectId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    const n = parseQty(qty);
    if (
      !validate([
        ["what", free && !description.trim(), ta("what_required")],
        ["qty", n == null || n <= 0, ta("qty_required")],
        ["project", request.forProject && !projectId, ta("st_project_required")],
      ])
    )
      return;
    setSaving(true);
    const res = await editPurchaseRequestAction(request.id, {
      description: free ? description : undefined,
      qty: n!,
      unit: free ? unit : undefined,
      projectId,
      reason: notes,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ta("edit_request")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {free && (
            <Field label={ta("f_what")} required error={error("what")}>
              <Input
                value={description}
                onChange={(ev) => {
                  setDescription(ev.target.value);
                  clear("what");
                }}
                placeholder={ta("f_what_ph")}
              />
            </Field>
          )}
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <Field label={ta("qty")} required error={error("qty")}>
              <QtyInput
                value={qty}
                onChange={(v) => {
                  setQty(v);
                  clear("qty");
                }}
              />
            </Field>
            {free && (
              <Field label={ta("f_unit")}>
                <Select value={unit} onValueChange={(v) => setUnit(v as InventoryUnit)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {ta(`unit_${u}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label={ta("dest_project")} required={request?.forProject} error={error("project")}>
            <div className="flex items-center gap-2 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1">
              <Combo
                options={projectOptions}
                value={projectId}
                onChange={(id) => {
                  setProjectId(id);
                  clear("project");
                }}
                placeholder={ta("pick_project")}
              />
              {projectId && !request?.forProject && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setProjectId(null)}>
                  {ta("remove")}
                </Button>
              )}
            </div>
          </Field>
          <Field label={request?.forProject ? ta("f_special_notes") : ta("f_reason")}>
            <Textarea rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder={request?.forProject ? ta("f_special_notes_ph") : ta("f_reason_ph")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ta("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? ta("saving") : ta("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
