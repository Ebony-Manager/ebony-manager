"use client";

import * as React from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { MessageCircle } from "lucide-react";

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
  const clientById = React.useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const stats = existing ? clientStats(existing.id, opportunities) : null;
  const myProjects = existing ? projects.filter((p) => p.designerId === existing.id || p.clientId === existing.id) : [];
  const wa = whatsappUrl(form.phone, "");

  async function save() {
    if (!form.name.trim()) return setError(tv("name_required"));
    setSaving(true);
    setError(null);
    if (existing) {
      const res = await updateClientAction(existing.id, form);
      setSaving(false);
      if (!res.ok) return setError(res.error);
    } else {
      const res = await createClientAction(form);
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
            <Field label={tv("f_name")}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!existing} />
            </Field>
            <Field label={tv("f_company")}>
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder={tv("optional")} />
            </Field>
            <Field label={tv("f_phone")}>
              <div className="flex gap-2">
                <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="6000-0000" />
                {wa && (
                  <Button asChild variant="outline" size="icon" className="shrink-0" title={tv("whatsapp_open")} aria-label={tv("whatsapp_open")}>
                    <a href={wa.replace(/\?text=$/, "")} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" />
                    </a>
                  </Button>
                )}
              </div>
            </Field>
            <Field label={tv("f_email")}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={tv("optional")} />
            </Field>
          </div>
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
