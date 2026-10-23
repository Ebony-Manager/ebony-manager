"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { MessageCircle, Plus } from "lucide-react";

import type { Supplier, SupplierKind } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { whatsappUrl } from "@/lib/almacen/inventory";
import { Field } from "../../contratistas/field";
import { createSupplierAction, updateSupplierAction } from "../actions";
import { EmptyBox, PageHeader, SearchBox, useTa } from "../shared";

type Filter = "active" | "inactive" | "all";

/** Proveedores de materiales y servicios. El ícono de WhatsApp abre el chat. */
export function SuppliersView({ suppliers, canEdit }: { suppliers: Supplier[]; canEdit: boolean }) {
  const { ta } = useTa();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("active");
  const [editing, setEditing] = React.useState<Supplier | "new" | null>(null);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => filter === "all" || (filter === "active" ? s.active : !s.active))
      .filter((s) => !q || [s.name, s.contactName, s.notes].some((x) => (x ?? "").toLowerCase().includes(q)));
  }, [suppliers, query, filter]);

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
      <PageHeader
        title={ta("suppliers_title")}
        subtitle={ta("suppliers_subtitle")}
        action={
          canEdit && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" />
              {ta("new_supplier")}
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
        <SegmentedFilter
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: ta("filter_active") },
            { value: "inactive", label: ta("filter_inactive") },
            { value: "all", label: ta("filter_all") },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyBox>{suppliers.length === 0 ? ta("suppliers_empty") : ta("no_results")}</EmptyBox>
      ) : (
        <div className="overflow-x-auto border border-ink-900/8 bg-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/8 text-xs text-muted-foreground">
                <th className="px-3.5 py-2 text-left font-medium">{ta("col_supplier")}</th>
                <th className="px-3 py-2 text-left font-medium">{ta("f_contact")}</th>
                <th className="px-3 py-2 text-left font-medium">{ta("f_whatsapp")}</th>
                <th className="px-3.5 py-2 text-right font-medium">{ta("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const wa = whatsappUrl(s.whatsapp, "");
                return (
                  <tr
                    key={s.id}
                    onClick={() => setEditing(s)}
                    className="cursor-pointer border-b border-ink-900/8 last:border-0 hover:bg-muted/30"
                  >
                    <td className="max-w-0 px-3.5 py-2.5">
                      <span className="block truncate font-semibold text-foreground">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{ta(`sk_${s.kind}`)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <span className="block">{s.contactName || "—"}</span>
                      {s.phone && <span className="block text-xs">{s.phone}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-walnut hover:underline"
                          title={ta("open_whatsapp")}
                        >
                          <MessageCircle className="size-4" />
                          {s.whatsapp}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <Badge variant={s.active ? "secondary" : "outline"}>{s.active ? ta("active") : ta("inactive")}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SupplierDialog supplier={editing} canEdit={canEdit} onClose={() => setEditing(null)} />
    </div>
  );
}

function SupplierDialog({ supplier, canEdit, onClose }: { supplier: Supplier | "new" | null; canEdit: boolean; onClose: () => void }) {
  const { ta } = useTa();
  const current = supplier && supplier !== "new" ? supplier : null;
  const [form, setForm] = React.useState({
    name: "",
    kind: "materiales" as SupplierKind,
    contactName: "",
    whatsapp: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    active: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir. */
  React.useEffect(() => {
    if (!supplier) return;
    setForm({
      name: current?.name ?? "",
      kind: current?.kind ?? "materiales",
      contactName: current?.contactName ?? "",
      whatsapp: current?.whatsapp ?? "",
      phone: current?.phone ?? "",
      email: current?.email ?? "",
      address: current?.address ?? "",
      notes: current?.notes ?? "",
      active: current?.active ?? true,
    });
    setError(null);
  }, [supplier, current]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const readOnly = !canEdit;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError(ta("name_required"));
    setSaving(true);
    const res = current ? await updateSupplierAction(current.id, form) : await createSupplierAction(form);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  return (
    <Dialog open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? ta("supplier_view_title") : current ? ta("supplier_edit_title") : ta("supplier_new_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
              <Field label={ta("f_name")}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!readOnly} />
              </Field>
              <Field label={ta("f_kind")}>
                <Select value={form.kind} onValueChange={(v) => set("kind", v as SupplierKind)} disabled={readOnly}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materiales">{ta("sk_materiales")}</SelectItem>
                    <SelectItem value="servicio">{ta("sk_servicio")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={ta("f_contact")}>
              <Input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder={ta("optional")} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={ta("f_whatsapp")} hint={ta("f_whatsapp_hint")}>
                <Input inputMode="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="6000-0000" />
              </Field>
              <Field label={ta("f_phone")}>
                <Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder={ta("optional")} />
              </Field>
            </div>
            <Field label={ta("f_email")}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={ta("optional")} />
            </Field>
            <Field label={ta("f_address")}>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={ta("optional")} />
            </Field>
            <Field label={ta("notes")}>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
              {ta("active")}
            </label>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!readOnly && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                {ta("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? ta("saving") : ta("save")}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
