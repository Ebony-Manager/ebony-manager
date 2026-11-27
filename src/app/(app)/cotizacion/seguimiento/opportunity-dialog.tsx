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
import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusKey } from "@/lib/ui/status";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { formatDateCompact } from "@/lib/planilla/format";
import { formatMoney } from "@/lib/cotizador/pricing";
import { opportunityAmount, suggestedProjectName, whoOf } from "@/lib/ventas/opportunities";
import { strings, t } from "@/lib/i18n";
import { Field } from "../../contratistas/field";
import { projectPath } from "../../proyectos/paths";
import {
  addOpportunityNoteAction,
  createOpportunityAction,
  deleteOpportunityAction,
  getOpportunityNotesAction,
  updateOpportunityAction,
} from "../ventas-actions";
import { ClientPicker, StageBadge, StageLabel, useTv } from "../ventas-common";
import { ClientDialog } from "../clientes/client-dialog";
import { cn } from "@/lib/utils";
import { FormSection } from "@/components/shared/form-section";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import { DriveFiles, PendingFiles, uploadFilesToDrive } from "@/components/shared/drive-files";
import { ensureOpportunityFolderAction } from "../../drive-actions";
import { EmptyState } from "@/components/shared/page-header";

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
  designerContactId: string | null;
  clientId: string | null;
  location: string;
  building: string;
  unit: string;
  stage: Stage;
  lostReason: LostReason | null;
  lostNote: string;
  receivedOn: string;
  dueOn: string;
  nextFollowUp: string;
  ownerId: string | null;
  driveFolderUrl: string;
  notes: string;
}

/** Nueva: el responsable por defecto es quien la crea (se puede cambiar). */
function formOf(o: Opportunity | null, currentUserId: string | null): Form {
  return {
    title: o?.title ?? "",
    designerId: o?.designerId ?? null,
    designerContactId: o?.designerContactId ?? null,
    clientId: o?.clientId ?? null,
    location: o?.location ?? "",
    building: o?.building ?? "",
    unit: o?.unit ?? "",
    stage: o?.stage ?? "por_cotizar",
    lostReason: o?.lostReason ?? null,
    lostNote: o?.lostNote ?? "",
    receivedOn: o?.receivedOn ?? todayInPanama(),
    dueOn: o?.dueOn ?? "",
    nextFollowUp: o?.nextFollowUp ?? "",
    ownerId: o ? o.ownerId : currentUserId,
    driveFolderUrl: o?.driveFolderUrl ?? "",
    notes: o?.notes ?? "",
  };
}

/**
 * La ficha de una oportunidad: quiénes (arquitecto y/o cliente final, se
 * crean ahí mismo si no existen), etapa, fechas, responsable y notas. El
 * monto sale siempre de la cotización vigente y el próximo seguimiento se
 * pone solo al enviarla. Si ya existe,
 * además: sus cotizaciones del cotizador, la bitácora y Aprobar.
 */
export function OpportunityDialog({
  opportunity,
  clients,
  people,
  onClose,
  onApprove,
  driveEnabled,
  currentUserId,
}: {
  opportunity: Opportunity | "new" | null;
  clients: Client[];
  people: SalesPerson[];
  onClose: () => void;
  onApprove: (o: Opportunity) => void;
  driveEnabled: boolean;
  currentUserId: string | null;
}) {
  const { tv, lang } = useTv();
  const open = opportunity !== null;
  const existing = opportunity && opportunity !== "new" ? opportunity : null;
  const [form, setForm] = React.useState<Form>(() => formOf(existing, currentUserId));
  const [created, setCreated] = React.useState<Client[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"who" | "lostReason">();
  /** Cómo estaba el formulario al abrir, para avisar si se cierra con cambios sin guardar. */
  const initial = React.useRef("");
  /** Nueva: archivos elegidos antes de guardar (se suben a su carpeta al guardar). */
  const [pending, setPending] = React.useState<File[]>([]);
  /** El nombre del proyecto se arma solo ("arquitecto o cliente – ubicación") hasta que la persona lo escribe. */
  const titleTouched = React.useRef(false);
  const [uploadingNew, setUploadingNew] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setForm(formOf(existing, currentUserId));
    initial.current = JSON.stringify(formOf(existing, currentUserId));
    titleTouched.current = !!existing?.title.trim();
    reset();
    setSaving(false);
    setPending([]);
    setUploadingNew(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir o cambiar de ficha.
  }, [open, existing?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const allClients = React.useMemo(() => [...clients, ...created.filter((c) => !clients.some((x) => x.id === c.id))], [clients, created]);
  const update = (patch: Partial<Form>) =>
    setForm((f) => {
      const next = { ...f, ...patch };
      if (!titleTouched.current && ("designerId" in patch || "clientId" in patch || "building" in patch || "unit" in patch)) {
        const who = whoOf(next.designerId, next.clientId, (id) => allClients.find((c) => c.id === id)?.name);
        next.title = suggestedProjectName(who, next.building, next.unit);
      }
      return next;
    });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    update({ [k]: v } as Partial<Form>);
    if (k === "lostReason") clear("lostReason");
    if (k === "clientId") clear("who");
  };
  const isDirty = React.useCallback(() => JSON.stringify(form) !== initial.current || pending.length > 0, [form, pending]);
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);
  const fromQuote = (existing?.quotes.length ?? 0) > 0;
  const firmContacts = allClients.find((c) => c.id === form.designerId)?.contacts ?? [];
  const stageOptions = STAGES.filter((s) => s !== "aprobada" || form.stage === "aprobada");
  // Solo tiene sentido ya enviada (la base la pone sola a los 7 días); se puede mover.
  const showFollowUp = existing?.stage === "enviada" && form.stage === "enviada";

  // "Crear «Nombre»" en el selector abre la ficha completa del cliente (celular, correo, empresa…).
  const [newClient, setNewClient] = React.useState<{ name: string; kind: ClientKind } | null>(null);
  async function createClient(kind: ClientKind, name: string) {
    setNewClient({ name, kind });
  }

  async function save() {
    const ok = validate([
      ["who", !form.designerId && !form.clientId, tv("someone_required")],
      ["lostReason", form.stage === "perdida" && !form.lostReason, tv("lost_reason_required")],
    ]);
    if (!ok) return;
    setSaving(true);
    const input = {
      title: form.title,
      designerId: form.designerId,
      designerContactId: form.designerContactId,
      clientId: form.clientId,
      location: form.location,
      building: form.building,
      unit: form.unit,
      stage: form.stage,
      lostReason: form.lostReason,
      lostNote: form.lostNote,
      receivedOn: form.receivedOn || todayInPanama(),
      dueOn: form.dueOn || null,
      nextFollowUp: form.nextFollowUp || null,
      ownerId: form.ownerId,
      // Con Drive conectado la carpeta la maneja la app: se conserva la guardada.
      driveFolderUrl: driveEnabled ? (existing?.driveFolderUrl ?? null) : form.driveFolderUrl,
      notes: form.notes,
    };
    if (existing) {
      const res = await updateOpportunityAction(existing.id, input);
      setSaving(false);
      if (!res.ok) return void toast.error(res.error);
    } else {
      const res = await createOpportunityAction(input);
      if (!res.ok) {
        setSaving(false);
        return void toast.error(res.error);
      }
      // Con archivos: se crea su carpeta en Drive y se suben ahí.
      if (driveEnabled && pending.length) {
        setUploadingNew(true);
        const folder = await ensureOpportunityFolderAction(res.data);
        if (!folder.ok) toast.error(folder.error);
        else {
          // Lo que se adjunta al crearla es lo que mandó el cliente: va a INFORMACION DE CLIENTE.
          const { done, failed } = await uploadFilesToDrive(folder.data.uploadTo, pending);
          for (const f of failed) toast.error(`${f.name}: ${f.error}`);
          if (done) toast.success(`${t(lang, strings.drive.uploaded)} (${done})`);
        }
      }
      setSaving(false);
    }
    toast.success(tv("saved"));
    onClose();
  }

  async function remove() {
    if (!existing) return;
    const res = await deleteOpportunityAction(existing.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(tv("deleted"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {existing ? existing.title.trim() || tv("seg_title") : tv("opp_title_new")}
            {existing && <StageBadge stage={existing.stage} />}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <FormSection icon={ICON.people} title={tv("sec_who")} note={error("who") ? undefined : tv("f_someone_hint")} error={error("who")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tv("f_designer")} icon={ICON.firm} invalid={!!error("who")}>
              <ClientPicker
                clients={allClients}
                kind="arquitecto"
                value={form.designerId}
                onChange={(id) => {
                  clear("who");
                  update({ designerId: id, designerContactId: null });
                }}
                onClear={() => update({ designerId: null, designerContactId: null })}
                onCreate={(n) => createClient("arquitecto", n)}
                placeholder={tv("pick_designer")}
              />
              {firmContacts.length > 0 && (
                <Select value={form.designerContactId ?? "__firm"} onValueChange={(v) => set("designerContactId", v === "__firm" ? null : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__firm">{tv("contact_any")}</SelectItem>
                    {firmContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.role ? `${c.name} · ${c.role}` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={tv("f_client")} icon={ICON.client} invalid={!!error("who")}>
              <ClientPicker
                clients={allClients}
                kind="cliente"
                value={form.clientId}
                onChange={(id) => set("clientId", id)}
                onClear={() => set("clientId", null)}
                onCreate={(n) => createClient("cliente", n)}
                placeholder={tv("pick_client")}
              />
            </Field>
          </div>
          </FormSection>

          <FormSection icon={ICON.project} title={tv("sec_project")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tv("f_building")} icon={ICON.building}>
              <Input value={form.building} onChange={(e) => set("building", e.target.value)} placeholder={tv("f_building_ph")} />
            </Field>
            <Field label={tv("f_unit")} icon={ICON.unit} hint={tv("f_unit_hint")}>
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder={tv("f_unit_ph")} />
            </Field>
            <Field label={tv("f_location")} icon={ICON.location}>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={tv("f_location_ph")} />
            </Field>
            <Field label={tv("f_project_name")} icon={ICON.project} hint={tv("f_project_name_hint")}>
              <Input
                value={form.title}
                onChange={(e) => {
                  titleTouched.current = e.target.value.trim() !== "";
                  update({ title: e.target.value });
                }}
                placeholder={tv("f_project_ph")}
              />
            </Field>
          </div>
          </FormSection>

          <FormSection icon={ICON.opportunity} title={tv("sec_tracking")} quiet>
          <div className={cn("grid grid-cols-1 gap-3 min-[480px]:grid-cols-2", fromQuote && "sm:grid-cols-3")}>
            <Field label={tv("f_stage")}>
              <Select value={form.stage} onValueChange={(v) => set("stage", v as Stage)} disabled={form.stage === "aprobada"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      <StageLabel stage={s} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={tv("f_owner")} icon={ICON.owner}>
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
            {fromQuote && (
              <Field label={tv("f_amount")} hint={tv("f_amount_hint_quote")}>
                <Input readOnly value={formatMoney(opportunityAmount(existing!) ?? 0)} className="bg-muted/40 tabular-nums" />
              </Field>
            )}
          </div>

          {form.stage === "perdida" && (
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field label={tv("f_lost_reason")} required error={error("lostReason")}>
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
                <Input value={form.lostNote} onChange={(e) => set("lostNote", e.target.value)} />
              </Field>
              {existing?.stage !== "perdida" && existing?.driveFolderId && !existing.projectId && (
                <p className="text-xs text-destructive sm:col-span-2">{tv("lost_drive_warning")}</p>
              )}
            </div>
          )}

          <div className={cn("grid grid-cols-1 gap-3 min-[480px]:grid-cols-2", showFollowUp && "sm:grid-cols-3")}>
            <Field label={tv("f_received")} icon={ICON.date}>
              <Input type="date" value={form.receivedOn} onChange={(e) => set("receivedOn", e.target.value)} />
            </Field>
            <Field label={tv("f_due")} icon={ICON.date}>
              <Input type="date" value={form.dueOn} onChange={(e) => set("dueOn", e.target.value)} />
            </Field>
            {showFollowUp && (
              <Field label={tv("f_follow_up")} icon={ICON.date} hint={tv("f_follow_up_hint")}>
                <Input type="date" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} />
              </Field>
            )}
          </div>

          </FormSection>

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
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          {!existing && driveEnabled && (
            <FormSection icon={ICON.files} title={t(lang, strings.drive.title)}>
              <PendingFiles files={pending} onChange={setPending} disabled={saving} />
            </FormSection>
          )}

          {existing && (
            <>
              <LinkedQuotes o={existing} lang={lang} />
              {driveEnabled && (
                <FormSection icon={ICON.files} title={t(lang, strings.drive.title)}>
                  <DriveFiles
                    enabled
                    folderId={existing.driveFolderId}
                    onCreate={async () => {
                      const res = await ensureOpportunityFolderAction(existing.id);
                      if (!res.ok) toast.error(res.error);
                      return res.ok ? res.data : null;
                    }}
                  />
                </FormSection>
              )}
              <NotesLog id={existing.id} />
            </>
          )}

        </div>

        <DialogFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex gap-2 max-sm:[&>button]:flex-1">
            <Button variant="outline" onClick={() => void requestClose()}>
              {tv("cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {uploadingNew ? t(lang, strings.drive.uploading_files) : saving ? tv("saving") : tv("save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {discardDialog}
      <ClientDialog
        client={newClient}
        clients={allClients}
        opportunities={[]}
        projects={[]}
        onClose={() => setNewClient(null)}
        onCreated={(c) => {
          setCreated((list) => [...list, c]);
          set(c.kind === "arquitecto" ? "designerId" : "clientId", c.id);
        }}
      />
    </Dialog>
  );
}

/** Las cotizaciones del cotizador ligadas; la primera es la vigente. */
function LinkedQuotes({ o, lang }: { o: Opportunity; lang: "es" | "en" }) {
  const { tv } = useTv();
  const anyApproved = o.quotes.some((q) => q.status === "APROBADA");
  return (
    <FormSection
      icon={ICON.quote}
      title={tv("quotes_title")}
      action={
        <Button asChild size="sm" variant="outline">
          <Link href={`/cotizacion/nueva?oportunidad=${o.id}`}>
            <FilePlus2 className="size-3.5" />
            {tv("new_quote")}
          </Link>
        </Button>
      }
    >
      {o.quotes.length === 0 ? (
        <EmptyState>{tv("quotes_empty")}</EmptyState>
      ) : (
        <ul className="flex flex-col rounded-lg border border-border">
          {o.quotes.map((q, i) => (
            <li key={q.id} className="border-b border-border last:border-0">
              <Link prefetch={false} href={`/cotizacion/${q.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{q.number}</span>
                <span className="text-xs text-muted-foreground">{formatDateCompact(lang, q.quoteDate)}</span>
                <StatusBadge status={`quote_${q.status}` as StatusKey}>{t(lang, strings.cotizador[`status_${q.status}` as keyof typeof strings.cotizador] ?? { es: q.status, en: q.status })}</StatusBadge>
                {/* «Vigente» solo si no hay aprobadas: con aprobadas, esas son las que cuentan (pueden ser varias). */}
                {i === 0 && !anyApproved && <Badge variant="secondary">{tv("quote_current")}</Badge>}
                <span className="ml-auto tabular-nums">{formatMoney(q.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
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
    <FormSection icon={ICON.note} title={tv("notes_title")}>
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
    </FormSection>
  );
}
