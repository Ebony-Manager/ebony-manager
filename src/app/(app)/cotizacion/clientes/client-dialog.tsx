"use client";

import * as React from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { UserPlus, X } from "lucide-react";

import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";

import { CLIENT_KINDS, type Client, type ClientKind, type Opportunity } from "@/types/ventas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { ShowToggle } from "@/components/shared/page-header";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatMoney } from "@/lib/cotizador/pricing";
import { whatsappUrl } from "@/lib/almacen/inventory";
import { clientStats, opportunityAmount, opportunityTitle } from "@/lib/ventas/opportunities";
import { Field } from "../../contratistas/field";
import { projectPath } from "../../proyectos/paths";
import { createClientAction, updateClientAction } from "../ventas-actions";
import { SEGUIMIENTO_PATH, StageBadge, useTv } from "../ventas-common";
import type { SalesProject } from "../seguimiento/opportunity-dialog";

interface Form {
  name: string;
  kind: ClientKind;
  phone: string;
  whatsapp: string;
  email: string;
  company: string;
  notes: string;
  active: boolean;
  contacts: { id?: string; name: string; role: string; phone: string; email: string }[];
}

const formOf = (c: Client | null): Form => ({
  name: c?.name ?? "",
  kind: c?.kind ?? "arquitecto",
  // Un solo número: el celular (también es el de WhatsApp).
  phone: c?.phone ?? c?.whatsapp ?? "",
  whatsapp: "",
  email: c?.email ?? "",
  company: c?.company ?? "",
  notes: c?.notes ?? "",
  active: c?.active ?? true,
  contacts: (c?.contacts ?? []).map((k) => ({ id: k.id, name: k.name, role: k.role ?? "", phone: k.phone ?? "", email: k.email ?? "" })),
});

/**
 * Ficha del cliente: datos de contacto y, si ya existe, sus números,
 * oportunidades y proyectos. Nuevo: `client` = "new" o { name, kind } (desde
 * la oportunidad, con el nombre ya escrito); `onCreated` recibe el creado.
 */
export function ClientDialog({
  client,
  clients,
  opportunities,
  projects,
  onClose,
  onCreated,
}: {
  client: Client | "new" | { name: string; kind: ClientKind } | null;
  clients: Client[];
  opportunities: Opportunity[];
  projects: SalesProject[];
  onClose: () => void;
  onCreated?: (c: Client) => void;
}) {
  const { tv, lang } = useTv();
  const open = client !== null;
  const existing = client && client !== "new" && "id" in client ? client : null;
  const draft = client && client !== "new" && !("id" in client) ? client : null;
  const [form, setForm] = React.useState<Form>(() => ({ ...formOf(existing), ...draft }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setForm({ ...formOf(existing), ...draft });
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir o cambiar de ficha.
  }, [open, existing?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isFirm = form.kind === "arquitecto";
  const clientById = React.useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const stats = existing ? clientStats(existing.id, opportunities) : null;
  const myProjects = existing ? projects.filter((p) => p.designerId === existing.id || p.clientId === existing.id) : [];
  const wa = whatsappUrl(form.phone, "");

  async function save() {
    if (!form.name.trim()) return setError(tv("name_required"));
    setSaving(true);
    setError(null);
    // Los contactos son de las firmas (arquitecto/diseñador); un cliente final no los usa.
    const input = { ...form, contacts: form.kind === "arquitecto" ? form.contacts : undefined };
    if (existing) {
      const res = await updateClientAction(existing.id, input);
      setSaving(false);
      if (!res.ok) return setError(res.error);
    } else {
      const res = await createClientAction(input);
      setSaving(false);
      if (!res.ok) return setError(res.error);
      onCreated?.(res.data);
    }
    toast.success(tv("saved"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? existing.name : tv("new_client")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label={tv("cli_quoted")} value={formatMoney(stats.quoted)} />
              <Stat label={tv("cli_approved")} value={formatMoney(stats.approved)} />
              <Stat label={tv("cli_close_rate")} value={stats.closeRate == null ? "—" : `${Math.round(stats.closeRate * 100)}%`} />
            </div>
          )}

          <Field label={tv("f_kind")}>
            <SegmentedFilter
              fill
              value={form.kind}
              onChange={(v) => set("kind", v)}
              options={CLIENT_KINDS.map((k) => ({ value: k, label: tv(`kind_${k}`) }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Arquitecto/diseñador: el nombre ES la firma (las personas van en Contactos). */}
            <Field
              label={isFirm ? tv("f_firm") : tv("f_name")}
              hint={isFirm ? tv("f_firm_hint") : undefined}
              className={isFirm && !form.company ? "sm:col-span-2" : undefined}
            >
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!existing} placeholder={isFirm ? tv("f_firm_ph") : undefined} />
            </Field>
            {(!isFirm || form.company) && (
              <Field label={tv("f_company")}>
                <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder={tv("optional")} />
              </Field>
            )}
            <Field label={tv("f_phone")}>
              <div className="flex gap-2">
                <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="6000-0000" />
                {wa && (
                  <Button asChild variant="outline" size="icon" className="shrink-0" title={tv("whatsapp_open")} aria-label={tv("whatsapp_open")}>
                    <a href={wa.replace(/\?text=$/, "")} target="_blank" rel="noreferrer">
                      <WhatsAppIcon brand className="size-[18px]" />
                    </a>
                  </Button>
                )}
              </div>
            </Field>
            <Field label={tv("f_email")}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={tv("optional")} />
            </Field>
          </div>
          {form.kind === "arquitecto" && (
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{tv("contacts_title")}</h3>
                  <p className="text-xs text-muted-foreground">{tv("contacts_hint")}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => set("contacts", [...form.contacts, { name: "", role: "", phone: "", email: "" }])}
                >
                  <UserPlus className="size-3.5" />
                  {tv("contact_add")}
                </Button>
              </div>
              {form.contacts.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {form.contacts.map((c, i) => {
                    const edit = (patch: Partial<typeof c>) => set("contacts", form.contacts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <li key={c.id ?? `new-${i}`} className="flex items-start gap-2 rounded-lg border border-border p-2">
                        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
                          <Input value={c.name} onChange={(e) => edit({ name: e.target.value })} placeholder={tv("contact_name")} aria-label={tv("contact_name")} />
                          <Input value={c.role} onChange={(e) => edit({ role: e.target.value })} placeholder={tv("contact_role")} aria-label={tv("contact_role")} />
                          <Input type="tel" inputMode="tel" value={c.phone} onChange={(e) => edit({ phone: e.target.value })} placeholder={tv("f_phone")} aria-label={tv("f_phone")} />
                          <Input type="email" value={c.email} onChange={(e) => edit({ email: e.target.value })} placeholder={tv("f_email")} aria-label={tv("f_email")} />
                        </div>
                        {whatsappUrl(c.phone, "") && (
                          <a
                            href={whatsappUrl(c.phone, "")!.replace(/\?text=$/, "")}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={tv("whatsapp_open")}
                            title={tv("whatsapp_open")}
                            className="mt-1.5 flex size-7 shrink-0 items-center justify-center rounded hover:bg-muted"
                          >
                            <WhatsAppIcon brand className="size-[18px]" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => set("contacts", form.contacts.filter((_, j) => j !== i))}
                          aria-label={tv("remove")}
                          title={tv("remove")}
                          className="mt-1.5 flex size-7 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <Field label={tv("f_notes")}>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={tv("optional")} />
          </Field>
          {existing && <ShowToggle checked={form.active} onChange={(v) => set("active", v)} label={tv("f_active")} />}

          {stats && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{tv("cli_opps_list")}</h3>
              {stats.opportunities.length === 0 ? (
                <p className="text-xs text-muted-foreground">{tv("cli_none")}</p>
              ) : (
                <ul className="flex flex-col rounded-lg border border-border">
                  {stats.opportunities.map((o) => {
                    const amount = opportunityAmount(o);
                    return (
                      <li key={o.id} className="border-b border-border last:border-0">
                        <Link href={`${SEGUIMIENTO_PATH}?abrir=${o.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm hover:bg-muted/30">
                          <span className="font-medium">{opportunityTitle(o, clientById)}</span>
                          <StageBadge stage={o.stage} />
                          <span className="text-xs text-muted-foreground">
                            {formatDateCompact(lang, o.receivedOn)} · {o.designerId === existing!.id ? tv("as_designer") : tv("as_client")}
                          </span>
                          <span className="ml-auto tabular-nums">{amount == null ? "—" : formatMoney(amount)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {myProjects.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{tv("cli_projects")}</h3>
              <ul className="flex flex-wrap gap-2">
                {myProjects.map((p) => (
                  <li key={p.id}>
                    <Button asChild size="sm" variant="outline">
                      <Link href={projectPath(p.id)}>{p.name}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tv("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? tv("saving") : tv("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
