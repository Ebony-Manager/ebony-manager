"use client";

import * as React from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CheckCircle2, ExternalLink, FilePlus2, FileText, FolderOpen } from "lucide-react";

import { LOST_REASONS, STAGES, type Client, type ClientKind, type LostReason, type Opportunity, type OpportunityNote, type SalesPerson, type Stage } from "@/types/ventas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatMoney } from "@/lib/cotizador/pricing";
import { opportunityAmount } from "@/lib/ventas/opportunities";
import { strings, t } from "@/lib/i18n";
import { Field } from "../../contratistas/field";
import { projectPath } from "../../proyectos/paths";
import {
  addOpportunityNoteAction,
  createClientAction,
  createOpportunityAction,
  deleteOpportunityAction,
  getOpportunityNotesAction,
  updateOpportunityAction,
} from "../ventas-actions";
import { ClientPicker, StageBadge, useTv } from "../ventas-common";
import { DriveFiles } from "@/components/shared/drive-files";
import { ensureOpportunityFolderAction } from "../../drive-actions";

export interface SalesProject {
  id: string;
  name: string;
  status: string;
  designerId: string | null;
  clientId: string | null;
}

interface Form {
  title: string;
  designerId: string | null;
  clientId: string | null;
  location: string;
  stage: Stage;
  lostReason: LostReason | null;
  lostNote: string;
  receivedOn: string;
  dueOn: string;
  nextFollowUp: string;
  ownerId: string | null;
  amount: string;
  driveFolderUrl: string;
  notes: string;
}

function formOf(o: Opportunity | null): Form {
  return {
    title: o?.title ?? "",
    designerId: o?.designerId ?? null,
    clientId: o?.clientId ?? null,
    location: o?.location ?? "",
    stage: o?.stage ?? "por_cotizar",
    lostReason: o?.lostReason ?? null,
    lostNote: o?.lostNote ?? "",
    receivedOn: o?.receivedOn ?? todayInPanama(),
    dueOn: o?.dueOn ?? "",
    nextFollowUp: o?.nextFollowUp ?? "",
    ownerId: o?.ownerId ?? null,
    amount: o?.amount == null ? "" : String(o.amount),
    driveFolderUrl: o?.driveFolderUrl ?? "",
    notes: o?.notes ?? "",
  };
}

/**
 * La ficha de una oportunidad: quiénes (arquitecto y/o cliente final, se
 * crean ahí mismo si no existen), etapa, fechas, responsable, monto (a mano
 * o el de la cotización vigente), carpeta de Drive y notas. Si ya existe,
 * además: sus cotizaciones del cotizador, la bitácora y Aprobar.
 */
export function OpportunityDialog({
  opportunity,
  clients,
  people,
  onClose,
  onApprove,
  driveEnabled,
}: {
  opportunity: Opportunity | "new" | null;
  clients: Client[];
  people: SalesPerson[];
  onClose: () => void;
  onApprove: (o: Opportunity) => void;
  driveEnabled: boolean;
}) {
  const { tv, lang } = useTv();
  const open = opportunity !== null;
  const existing = opportunity && opportunity !== "new" ? opportunity : null;
  const [form, setForm] = React.useState<Form>(() => formOf(existing));
  const [created, setCreated] = React.useState<Client[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setForm(formOf(existing));
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir o cambiar de ficha.
  }, [open, existing?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const allClients = React.useMemo(() => [...clients, ...created.filter((c) => !clients.some((x) => x.id === c.id))], [clients, created]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fromQuote = (existing?.quotes.length ?? 0) > 0;
  const stageOptions = STAGES.filter((s) => s !== "aprobada" || form.stage === "aprobada");

  async function createClient(kind: ClientKind, name: string) {
    const res = await createClientAction({ name, kind, phone: null, whatsapp: null, email: null, company: null, notes: null, active: true });
    if (!res.ok) return void toast.error(res.error);
    setCreated((c) => [...c, res.data]);
    set(kind === "arquitecto" ? "designerId" : "clientId", res.data.id);
  }

  async function save() {
    if (!form.designerId && !form.clientId) return setError(tv("someone_required"));
    if (form.stage === "perdida" && !form.lostReason) return setError(tv("lost_reason_required"));
    const amount = form.amount.trim() === "" ? null : Number(form.amount);
    setSaving(true);
    setError(null);
    const input = {
      title: form.title,
      designerId: form.designerId,
      clientId: form.clientId,
      location: form.location,
      stage: form.stage,
      lostReason: form.lostReason,
      lostNote: form.lostNote,
      receivedOn: form.receivedOn || todayInPanama(),
      dueOn: form.dueOn || null,
      nextFollowUp: form.nextFollowUp || null,
      ownerId: form.ownerId,
      amount: amount != null && Number.isFinite(amount) ? amount : null,
      // Con Drive conectado la carpeta la maneja la app: se conserva la guardada.
      driveFolderUrl: driveEnabled ? (existing?.driveFolderUrl ?? null) : form.driveFolderUrl,
      notes: form.notes,
    };
    const res = existing ? await updateOpportunityAction(existing.id, input) : await createOpportunityAction(input);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(tv("saved"));
    onClose();
  }

  async function remove() {
    if (!existing) return;
    const res = await deleteOpportunityAction(existing.id);
    if (!res.ok) return setError(res.error);
    toast.success(tv("deleted"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {existing ? existing.title.trim() || tv("seg_title") : tv("opp_title_new")}
            {existing && <StageBadge stage={existing.stage} />}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tv("f_designer")}>
              <PickerWithRemove
                value={form.designerId}
                onRemove={() => set("designerId", null)}
                picker={
                  <ClientPicker
                    clients={allClients}
                    kind="arquitecto"
                    value={form.designerId}
                    onChange={(id) => set("designerId", id)}
                    onCreate={(n) => createClient("arquitecto", n)}
                    placeholder={tv("pick_designer")}
                  />
                }
              />
            </Field>
            <Field label={tv("f_client")} hint={!form.designerId && !form.clientId ? tv("f_someone_hint") : undefined}>
              <PickerWithRemove
                value={form.clientId}
                onRemove={() => set("clientId", null)}
                picker={
                  <ClientPicker
                    clients={allClients}
                    kind="cliente"
                    value={form.clientId}
                    onChange={(id) => set("clientId", id)}
                    onCreate={(n) => createClient("cliente", n)}
                    placeholder={tv("pick_client")}
                  />
                }
              />
            </Field>
            <Field label={tv("f_project")}>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={tv("f_project_ph")} />
            </Field>
            <Field label={tv("f_location")}>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={tv("optional")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tv("f_stage")}>
              <Select value={form.stage} onValueChange={(v) => set("stage", v as Stage)} disabled={form.stage === "aprobada"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tv(`stage_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={tv("f_owner")}>
              <Select value={form.ownerId ?? ""} onValueChange={(v) => set("ownerId", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tv("pick_owner")} />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={tv("f_amount")} hint={fromQuote ? tv("f_amount_hint_quote") : tv("f_amount_hint_manual")}>
              {fromQuote ? (
                <Input readOnly value={formatMoney(opportunityAmount(existing!) ?? 0)} className="bg-muted/40 tabular-nums" />
              ) : (
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
              )}
            </Field>
          </div>

          {form.stage === "perdida" && (
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label={tv("f_lost_reason")}>
                <Select value={form.lostReason ?? ""} onValueChange={(v) => set("lostReason", v as LostReason)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tv("pick_owner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LOST_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {tv(`lost_${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tv("f_lost_note")}>
                <Input value={form.lostNote} onChange={(e) => set("lostNote", e.target.value)} placeholder={tv("optional")} />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tv("f_received")}>
              <Input type="date" value={form.receivedOn} onChange={(e) => set("receivedOn", e.target.value)} />
            </Field>
            <Field label={tv("f_due")}>
              <Input type="date" value={form.dueOn} onChange={(e) => set("dueOn", e.target.value)} />
            </Field>
            <Field label={tv("f_follow_up")}>
              <Input type="date" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
            </Field>
          </div>

          {!driveEnabled && (
          <Field label={tv("f_drive")}>
            <div className="flex gap-2">
              <Input value={form.driveFolderUrl} onChange={(e) => set("driveFolderUrl", e.target.value)} placeholder={tv("f_drive_ph")} />
              {/^https?:\/\//.test(form.driveFolderUrl.trim()) && (
                <Button asChild variant="outline" size="icon" className="shrink-0" title={tv("open_drive")} aria-label={tv("open_drive")}>
                  <a href={form.driveFolderUrl.trim()} target="_blank" rel="noreferrer">
                    <FolderOpen className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </Field>
          )}

          <Field label={tv("f_notes")}>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={tv("optional")} />
          </Field>

          {existing && (
            <>
              <LinkedQuotes o={existing} lang={lang} />
              {driveEnabled && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t(lang, strings.drive.title)}</h3>
                  <DriveFiles
                    enabled
                    folderId={existing.driveFolderId}
                    onCreate={async () => {
                      const res = await ensureOpportunityFolderAction(existing.id);
                      if (!res.ok) toast.error(res.error);
                      return res.ok ? res.data : null;
                    }}
                  />
                </section>
              )}
              <NotesLog id={existing.id} />
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {existing && existing.stage !== "aprobada" && (
              <Button variant="outline" className="text-success" onClick={() => onApprove(existing)}>
                <CheckCircle2 className="size-4" />
                {tv("approve")}
              </Button>
            )}
            {existing?.projectId && (
              <Button asChild variant="outline">
                <Link href={projectPath(existing.projectId)}>
                  <ExternalLink className="size-4" />
                  {tv("open_project")}
                </Link>
              </Button>
            )}
            {existing && existing.stage !== "aprobada" && (
              <ConfirmButton label={tv("delete")} confirmLabel={tv("delete_confirm")} onConfirm={() => void remove()} />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {tv("cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? tv("saving") : tv("save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickerWithRemove({ value, picker, onRemove }: { value: string | null; picker: React.ReactNode; onRemove: () => void }) {
  const { tv } = useTv();
  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">{picker}</div>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          {tv("remove")}
        </Button>
      )}
    </div>
  );
}

/** Las cotizaciones del cotizador ligadas; la primera es la vigente. */
function LinkedQuotes({ o, lang }: { o: Opportunity; lang: "es" | "en" }) {
  const { tv } = useTv();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{tv("quotes_title")}</h3>
        <Button asChild size="sm" variant="outline">
          <Link href={`/cotizacion/nueva?oportunidad=${o.id}`}>
            <FilePlus2 className="size-3.5" />
            {tv("new_quote")}
          </Link>
        </Button>
      </div>
      {o.quotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">{tv("quotes_empty")}</p>
      ) : (
        <ul className="flex flex-col rounded-lg border border-border">
          {o.quotes.map((q, i) => (
            <li key={q.id} className="border-b border-border last:border-0">
              <Link href={`/cotizacion/${q.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{q.number}</span>
                <span className="text-xs text-muted-foreground">{formatDateCompact(lang, q.quoteDate)}</span>
                <Badge variant="outline">{t(lang, strings.cotizador[`status_${q.status}` as keyof typeof strings.cotizador] ?? { es: q.status, en: q.status })}</Badge>
                {i === 0 && <Badge variant="secondary">{tv("quote_current")}</Badge>}
                <span className="ml-auto tabular-nums">{formatMoney(q.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Bitácora: llamadas, mensajes, lo que dijo el cliente. Lo más nuevo arriba. */
function NotesLog({ id }: { id: string }) {
  const { tv, lang } = useTv();
  const [notes, setNotes] = React.useState<OpportunityNote[] | null>(null);
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await getOpportunityNotesAction(id);
    setNotes(res.ok ? res.data : []);
  }, [id]);

  React.useEffect(() => {
    let alive = true;
    void getOpportunityNotesAction(id).then((res) => alive && setNotes(res.ok ? res.data : []));
    return () => {
      alive = false;
    };
  }, [id]);

  async function add() {
    if (!body.trim()) return;
    setSaving(true);
    const res = await addOpportunityNoteAction(id, body);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    setBody("");
    await load();
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{tv("notes_title")}</h3>
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={tv("note_ph")}
        />
        <Button variant="outline" onClick={() => void add()} disabled={saving || !body.trim()}>
          {tv("note_add")}
        </Button>
      </div>
      {notes === null ? null : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tv("notes_empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <p className="whitespace-pre-wrap text-foreground">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {[n.createdByName, formatDateCompact(lang, n.createdAt.slice(0, 10))].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
