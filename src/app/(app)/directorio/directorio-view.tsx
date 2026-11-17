"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";

import { ALL_SUPPLIER_RUBROS, SUPPLIER_RUBROS, type Supplier, type SupplierContact, type SupplierKind, type SupplierRubro } from "@/types/almacen";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListToolbar } from "@/components/shared/search-input";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, ShowToggle } from "@/components/shared/page-header";
import { mapsUrl, whatsappUrl } from "@/lib/almacen/inventory";
import { cn } from "@/lib/utils";
import { Field } from "@/components/shared/field";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import { createSupplierAction, updateSupplierAction } from "../almacen/actions";
import { EmptyBox, PageHeader, SearchBox, useTa } from "../almacen/shared";
import { matchesSearch, normalizeSearchText } from "@/lib/search";

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
    const q = normalizeSearchText(query);
    return suppliers
      .filter((s) => showInactive || s.active)
      .filter((s) => kind === "all" || s.kind === kind)
      .filter((s) => rubro === "all" || s.rubros.includes(rubro))
      .filter(
        (s) =>
          !q ||
          [s.name, s.contactName, s.specialty, s.notes, ...s.rubros.map((r) => ta(`ru_${r}`))].some((x) => matchesSearch(x, q)),
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
            { value: "all", label: ta("filter_all"), icon: ICON.all },
            { value: "materiales", label: ta("sk_materiales"), icon: ICON.materials },
            { value: "servicio", label: ta("kind_services"), icon: ICON.service },
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
  // Los contactos con WhatsApp: uno → directo; varios → menú para elegir a quién.
  const reachable = s.contacts.filter((c) => whatsappUrl(c.whatsapp, ""));
  const maps = mapsUrl(s.address);
  const contact = s.contacts
    .filter((c) => c.name || c.role)
    .map((c) => (c.name && c.role ? `${c.name} (${c.role})` : c.name || c.role))
    .join(" · ");
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
        {reachable.length === 1 && (
          <a href={whatsappUrl(reachable[0].whatsapp, "")!} target="_blank" rel="noreferrer" className={iconLink} title={ta("open_whatsapp")} aria-label={ta("open_whatsapp")}>
            <WhatsAppIcon brand className="size-[18px]" />
          </a>
        )}
        {reachable.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={iconLink} title={ta("open_whatsapp")} aria-label={ta("open_whatsapp")}>
                <WhatsAppIcon brand className="size-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {reachable.map((c, i) => (
                <DropdownMenuItem key={i} asChild>
                  <a href={whatsappUrl(c.whatsapp, "")!} target="_blank" rel="noreferrer">
                    <WhatsAppIcon brand className="size-4" />
                    <span>
                      <span className="block font-medium">{c.name || c.whatsapp}</span>
                      {c.role && <span className="block text-xs text-muted-foreground">{c.role}</span>}
                    </span>
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {maps && (
          <a href={maps} target="_blank" rel="noreferrer" className={iconLink} title={ta("open_maps")} aria-label={ta("open_maps")}>
            <ICON.location className="size-4" />
          </a>
        )}
        {s.email && (
          <a href={`mailto:${s.email}`} className={cn(iconLink, "hidden sm:flex")} title={s.email} aria-label={ta("f_email")}>
            <ICON.email className="size-4" />
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
    contacts: [] as SupplierContact[],
    // Teléfono y contacto viejos: no se editan (casi todo es WhatsApp); se conservan.
    contactName: "",
    whatsapp: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    active: true,
  });
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"name">();
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify(form));
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir. */
  React.useEffect(() => {
    if (!supplier) return;
    setForm({
      name: current?.name ?? "",
      rubros: current?.rubros ?? [],
      specialty: current?.specialty ?? "",
      contacts: current?.contacts.length ? current.contacts : [{ name: "", role: "", whatsapp: "" }],
      contactName: current?.contactName ?? "",
      whatsapp: current?.whatsapp ?? "",
      phone: current?.phone ?? "",
      email: current?.email ?? "",
      address: current?.address ?? "",
      notes: current?.notes ?? "",
      active: current?.active ?? true,
    });
    reset();
    setSaving(false);
    markSeeded();
  }, [supplier, current, reset, markSeeded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "name") clear("name");
  };
  const setContact = (i: number, patch: Partial<SupplierContact>) =>
    setForm((f) => ({ ...f, contacts: f.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const toggleRubro = (r: SupplierRubro) =>
    setForm((f) => ({ ...f, rubros: f.rubros.includes(r) ? f.rubros.filter((x) => x !== r) : [...f.rubros, r] }));
  const readOnly = !canEdit;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate([["name", !form.name.trim(), ta("name_required")]])) return;
    setSaving(true);
    const input = { ...form, kind: kindOf(form.rubros) };
    const res = current ? await updateSupplierAction(current.id, input) : await createSupplierAction(input);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(ta("saved"));
    onClose();
  }

  const rubroGroup = (k: SupplierKind, label: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {React.createElement(k === "materiales" ? ICON.materials : ICON.service, { className: "size-3.5" })}
        {label}
      </span>
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
    <Dialog open={!!supplier} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? ta("supplier_view_title") : current ? ta("supplier_edit_title") : ta("supplier_new_title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <Field label={ta("f_name")} icon={ICON.firm} required error={error("name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!current && !readOnly} />
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

            {/* Cada contacto es una tarjeta con sus campos titulados (UI-RULES): nada de cajas con el título adentro. */}
            <FormSection
              icon={ICON.people}
              title={ta("f_contacts")}
              action={
                !readOnly && (
                  <Button type="button" size="sm" variant="outline" onClick={() => set("contacts", [...form.contacts, { name: "", role: "", whatsapp: "" }])}>
                    <Plus className="size-3.5" />
                    {ta("add_contact")}
                  </Button>
                )
              }
            >
              <p className="-mt-1 text-xs text-muted-foreground">{ta("f_contacts_hint")}</p>
              {form.contacts.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {form.contacts.map((c, i) => (
                    <li key={i} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {ta("contact_n", { n: i + 1 })}
                          {i === 0 && ` · ${ta("contact_main")}`}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            title={ta("remove_contact")}
                            aria-label={ta("remove_contact")}
                            onClick={() => set("contacts", form.contacts.filter((_, j) => j !== i))}
                            className="flex size-7 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                        <Field label={ta("c_name")} icon={ICON.client}>
                          <Input value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                        </Field>
                        <Field label={ta("c_role")} icon={ICON.firm}>
                          <Input value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} placeholder={ta("c_role_ph")} />
                        </Field>
                        <Field label={ta("f_whatsapp")} icon={ICON.phone} className="min-[480px]:col-span-2">
                          <Input type="tel" inputMode="tel" value={c.whatsapp} onChange={(e) => setContact(i, { whatsapp: e.target.value })} placeholder="6000-0000" />
                        </Field>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>

            <Field label={ta("f_email")} icon={ICON.email}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={ta("f_location")} icon={ICON.location} hint={ta("f_location_hint")}>
              <Input inputMode="url" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={ta("f_location_ph")} />
            </Field>
            <Field label={ta("notes")}>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            {current && <ShowToggle checked={form.active} onChange={(v) => set("active", v)} label={ta("active")} />}
          </fieldset>

          {!readOnly && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
                {ta("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? ta("saving") : ta("save")}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
