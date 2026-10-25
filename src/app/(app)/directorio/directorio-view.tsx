"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Mail, Phone, Plus } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";

import { ALL_SUPPLIER_RUBROS, SUPPLIER_RUBROS, type Supplier, type SupplierKind, type SupplierRubro } from "@/types/almacen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListToolbar } from "@/components/shared/search-input";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, ShowToggle } from "@/components/shared/page-header";
import { whatsappUrl } from "@/lib/almacen/inventory";
import { cn } from "@/lib/utils";
import { Field } from "../contratistas/field";
import { createSupplierAction, updateSupplierAction } from "../almacen/actions";
import { EmptyBox, PageHeader, SearchBox, useTa } from "../almacen/shared";

type KindFilter = "all" | SupplierKind;
const NONE = "none";

/** Materiales si tiene algún rubro de materiales (o ninguno); si no, servicio. */
const kindOf = (rubros: SupplierRubro[]): SupplierKind =>
  rubros.length > 0 && rubros.every((r) => SUPPLIER_RUBROS.servicio.includes(r)) ? "servicio" : "materiales";

/**
 * Directorio de la empresa: proveedores de materiales y de servicios
 * (técnicos, mecánico, transporte, subcontratos…). La lista va agrupada por
 * el rubro principal de cada uno; cada tarjeta dice sus rubros, su
 * especialidad ("técnico de qué") y cómo contactarlo. Los contratistas no
 * van aquí: siguen en Personal.
 */
export function DirectorioView({ suppliers, canEdit }: { suppliers: Supplier[]; canEdit: boolean }) {
  const { ta } = useTa();
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [rubro, setRubro] = React.useState<SupplierRubro | "all">("all");
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | "new" | null>(null);

  const rubroOptions = kind === "all" ? ALL_SUPPLIER_RUBROS : SUPPLIER_RUBROS[kind];

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => showInactive || s.active)
      .filter((s) => kind === "all" || s.kind === kind)
      .filter((s) => rubro === "all" || s.rubros.includes(rubro))
      .filter(
        (s) =>
          !q ||
          [s.name, s.contactName, s.specialty, s.notes, ...s.rubros.map((r) => ta(`ru_${r}`))].some((x) => (x ?? "").toLowerCase().includes(q)),
      );
  }, [suppliers, query, kind, rubro, showInactive, ta]);

  // Grupos por rubro principal (el elegido en el filtro, si hay), en el orden de la lista fija.
  const groups = React.useMemo(() => {
    const byKey = new Map<string, Supplier[]>();
    for (const s of shown) {
      const key = rubro !== "all" ? rubro : (s.rubros[0] ?? NONE);
      byKey.set(key, [...(byKey.get(key) ?? []), s]);
    }
    return [...ALL_SUPPLIER_RUBROS, NONE].filter((k) => byKey.has(k)).map((k) => ({ key: k, items: byKey.get(k)! }));
  }, [shown, rubro]);

  return (
    <div className={PAGE_CLASS}>
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

      <ListToolbar>
        <SearchBox value={query} onChange={setQuery} placeholder={ta("search_ph")} />
        <SegmentedFilter
          value={kind}
          onChange={(k) => {
            setKind(k);
            setRubro("all");
          }}
          options={[
            { value: "all", label: ta("filter_all") },
            { value: "materiales", label: ta("sk_materiales") },
            { value: "servicio", label: ta("kind_services") },
          ]}
        />
        <Select value={rubro} onValueChange={(v) => setRubro(v as SupplierRubro | "all")}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ta("all_rubros")}</SelectItem>
            {rubroOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {ta(`ru_${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListToolbar>
      <ShowToggle className="-mt-2 self-end" checked={showInactive} onChange={setShowInactive} label={ta("show_inactive")} />

      {groups.length === 0 ? (
        <EmptyBox>{suppliers.length === 0 ? ta("suppliers_empty") : ta("no_results")}</EmptyBox>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.key === NONE ? ta("ru_none") : ta(`ru_${g.key as SupplierRubro}`)} <span className="font-normal">({g.items.length})</span>
            </h2>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {g.items.map((s) => (
                <SupplierRow key={s.id} supplier={s} onOpen={() => setEditing(s)} />
              ))}
            </ul>
          </section>
        ))
      )}

      <SupplierDialog supplier={editing} canEdit={canEdit} onClose={() => setEditing(null)} />
    </div>
  );
}

/** Una tarjeta del directorio: nombre, rubros, especialidad y contacto. */
function SupplierRow({ supplier: s, onOpen }: { supplier: Supplier; onOpen: () => void }) {
  const { ta } = useTa();
  const wa = whatsappUrl(s.whatsapp, "");
  const tel = s.phone ? `tel:${s.phone.replace(/[^\d+]/g, "")}` : null;
  const contact = [s.contactName, s.phone].filter(Boolean).join(" · ");
  const iconLink = "flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <li className={cn("flex items-center gap-3 px-3.5 py-3 active:bg-muted/40", !s.active && "opacity-60")}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-foreground">{s.name}</span>
          {!s.active && <Badge variant="outline">{ta("inactive")}</Badge>}
        </span>
        {s.rubros.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {s.rubros.map((r) => (
              <Badge key={r} variant="secondary" className="text-[11px] font-medium">
                {ta(`ru_${r}`)}
              </Badge>
            ))}
          </span>
        )}
        {s.specialty && <span className="line-clamp-2 text-sm text-foreground/80">{s.specialty}</span>}
        {contact && <span className="truncate text-xs text-muted-foreground">{contact}</span>}
      </button>
      <span className="flex shrink-0 items-center">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className={iconLink} title={ta("open_whatsapp")} aria-label={ta("open_whatsapp")}>
            <WhatsAppIcon brand className="size-[18px]" />
          </a>
        )}
        {tel && (
          <a href={tel} className={iconLink} title={s.phone ?? undefined} aria-label={ta("f_phone")}>
            <Phone className="size-4" />
          </a>
        )}
        {s.email && (
          <a href={`mailto:${s.email}`} className={cn(iconLink, "hidden sm:flex")} title={s.email} aria-label={ta("f_email")}>
            <Mail className="size-4" />
          </a>
        )}
      </span>
    </li>
  );
}

function SupplierDialog({ supplier, canEdit, onClose }: { supplier: Supplier | "new" | null; canEdit: boolean; onClose: () => void }) {
  const { ta } = useTa();
  const current = supplier && supplier !== "new" ? supplier : null;
  const [form, setForm] = React.useState({
    name: "",
    rubros: [] as SupplierRubro[],
    specialty: "",
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
      rubros: current?.rubros ?? [],
      specialty: current?.specialty ?? "",
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
  const toggleRubro = (r: SupplierRubro) =>
    setForm((f) => ({ ...f, rubros: f.rubros.includes(r) ? f.rubros.filter((x) => x !== r) : [...f.rubros, r] }));
  const readOnly = !canEdit;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError(ta("name_required"));
    setSaving(true);
    const input = { ...form, kind: kindOf(form.rubros) };
    const res = current ? await updateSupplierAction(current.id, input) : await createSupplierAction(input);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  const rubroGroup = (k: SupplierKind, label: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {SUPPLIER_RUBROS[k].map((r) => {
          const on = form.rubros.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => toggleRubro(r)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                on ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {ta(`ru_${r}`)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Dialog open={!!supplier} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? ta("supplier_view_title") : current ? ta("supplier_edit_title") : ta("supplier_new_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <Field label={ta("f_name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={ta("f_rubros")} hint={ta("f_rubros_hint")}>
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                {rubroGroup("materiales", ta("sk_materiales"))}
                {rubroGroup("servicio", ta("kind_services"))}
              </div>
            </Field>
            <Field label={ta("f_specialty")}>
              <Input value={form.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder={ta("f_specialty_ph")} />
            </Field>
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
