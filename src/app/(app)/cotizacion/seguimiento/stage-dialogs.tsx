"use client";

import * as React from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CircleAlert } from "lucide-react";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { ICON } from "@/lib/ui/concepts";

import { LOST_REASONS, type Client, type LostReason, type Opportunity } from "@/types/ventas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { defaultProjectName, openQuotes } from "@/lib/ventas/opportunities";
import { formatMoney } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { Field } from "../../contratistas/field";
import { projectPath } from "../../proyectos/paths";
import { approveOpportunityAction } from "../ventas-actions";
import { useTv } from "../ventas-common";
import type { SalesProject } from "./opportunity-dialog";
import { DesignerPick } from "@/components/shared/designer-pick";
import type { DesignerCandidate } from "@/types/designers";

/** Perdida: el motivo (obligatorio) y un detalle. */
export function LostDialog({
  opportunity,
  onClose,
  onConfirm,
}: {
  opportunity: Opportunity | null;
  onClose: () => void;
  onConfirm: (reason: LostReason, note: string | null) => Promise<void>;
}) {
  const { tv } = useTv();
  const [reason, setReason] = React.useState<LostReason | "">("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"reason">();
  const open = opportunity !== null;
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => !!reason || !!note.trim(), onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setSaving(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tv("move_to")} {tv("stage_perdida")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={tv("f_lost_reason")} required error={error("reason")}>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v as LostReason);
                clear("reason");
              }}
            >
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
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {opportunity && openQuotes(opportunity.quotes).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {tv("lost_quotes_rejected")} {openQuotes(opportunity.quotes).map((q) => q.number).join(", ")}
            </p>
          )}
          {opportunity?.driveFolderId && !opportunity.projectId && <p className="text-xs text-destructive">{tv("lost_drive_warning")}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void requestClose()}>
            {tv("cancel")}
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (!validate([["reason", !reason, tv("lost_reason_required")]])) return;
              setSaving(true);
              await onConfirm(reason as LostReason, note.trim() || null);
            }}
          >
            {saving ? tv("saving") : tv("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}

/**
 * Elegir cuáles cotizaciones aprobó el cliente (pueden ser varias: la cocina
 * y el closet…). Las que queden sin marcar pasan a rechazadas.
 */
export function QuotePickList({
  quotes,
  picked,
  onToggle,
  label,
  hint,
  error,
}: {
  quotes: { id: string; number: string; status: string; total: number }[];
  picked: string[];
  onToggle: (id: string) => void;
  label: string;
  hint: string;
  /** Falla (ej. "marca al menos una"): las opciones se marcan en rojo. */
  error?: string;
}) {
  const { tv } = useTv();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        {label}
        <span className="text-destructive" aria-hidden>
          {" "}
          *
        </span>
      </legend>
      {quotes.map((q) => {
        const on = picked.includes(q.id);
        return (
          <label
            key={q.id}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm", on ? "border-primary bg-primary/5" : error ? "border-destructive" : "border-border hover:bg-muted/40")}
          >
            <input type="checkbox" checked={on} onChange={() => onToggle(q.id)} aria-invalid={error ? true : undefined} className="size-4 accent-primary" />
            <span className="font-medium tabular-nums">{q.number}</span>
            <span className="text-xs text-muted-foreground">{tv(q.status === "ENVIADA" ? "quote_sent" : "quote_draft")}</span>
            <span className="ml-auto font-semibold tabular-nums">{formatMoney(q.total)}</span>
          </label>
        );
      })}
      {error ? (
        <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </fieldset>
  );
}

/**
 * Aprobar: crea el proyecto (con el arquitecto y el cliente final ya
 * enlazados) o lo enlaza a uno que ya existe.
 */
export function ApproveDialog({
  opportunity,
  clients,
  projects,
  designerCandidates,
  onClose,
}: {
  opportunity: Opportunity | null;
  clients: Map<string, Client>;
  projects: SalesProject[];
  designerCandidates: DesignerCandidate[];
  onClose: () => void;
}) {
  const { tv } = useTv();
  const open = opportunity !== null;
  const [mode, setMode] = React.useState<"new" | "existing">("new");
  const [name, setName] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"name" | "project" | "quotes">();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [designerIds, setDesignerIds] = React.useState<string[]>([]);
  const open_ = opportunity ? openQuotes(opportunity.quotes) : [];
  const initial = React.useRef("");
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => JSON.stringify({ mode, name, projectId, picked, designerIds }) !== initial.current, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!opportunity) return;
    // Con una sola cotización abierta, viene marcada.
    const abiertas = openQuotes(opportunity.quotes);
    const startPicked = abiertas.length === 1 ? [abiertas[0].id] : [];
    const startMode = opportunity.projectId ? "existing" : "new";
    const startName = defaultProjectName(opportunity, clients);
    const startProject = opportunity.projectId ?? "";
    setPicked(startPicked);
    setMode(startMode);
    setName(startName);
    setProjectId(startProject);
    // Proyecto nuevo sin diseñadora elegida: viene marcada la que le toca (turno); se puede cambiar.
    const turn = designerCandidates.find((c) => c.turnRank === 1)?.id;
    const startDesigners = opportunity.designerEmployeeIds.length > 0 ? opportunity.designerEmployeeIds : startMode === "new" && turn ? [turn] : [];
    setDesignerIds(startDesigners);
    initial.current = JSON.stringify({ mode: startMode, name: startName, projectId: startProject, picked: startPicked, designerIds: startDesigners });
    setSaving(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // La diseñadora del turno es para proyectos nuevos: al pasar a «proyecto existente» se quita si era la sugerida
  // (sin tocar), y vuelve si se regresa a «nuevo» sin haber elegido a nadie.
  const changeMode = (next: "new" | "existing") => {
    const turn = designerCandidates.find((c) => c.turnRank === 1)?.id;
    if (turn && next === "existing" && designerIds.length === 1 && designerIds[0] === turn) setDesignerIds([]);
    if (turn && next === "new" && designerIds.length === 0) setDesignerIds([turn]);
    setMode(next);
  };

  async function approve() {
    if (!opportunity) return;
    const ok = validate([
      ["name", mode === "new" && !name.trim(), tv("approve_name_required")],
      ["project", mode === "existing" && !projectId, tv("approve_project_required")],
      ["quotes", open_.length > 0 && picked.length === 0, tv("approve_quotes_required")],
    ]);
    if (!ok) return;
    setSaving(true);
    const res = await approveOpportunityAction(opportunity.id, mode === "new" ? name.trim() : null, mode === "existing" ? projectId : null, picked, designerIds);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    const id = res.data;
    toast.success(
      () => (
        <span className="flex items-center gap-2">
          {tv("approved_done")}
          <Link href={projectPath(id)} className="font-semibold text-primary underline-offset-2 hover:underline">
            {tv("open_project")}
          </Link>
        </span>
      ),
      { duration: 6000 },
    );
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tv("approve_title")}</DialogTitle>
          <DialogDescription>{tv("approve_hint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {projects.length > 0 && (
            <SegmentedFilter
              fill
              value={mode}
              onChange={changeMode}
              options={[
                { value: "new", label: tv("approve_new_project") },
                { value: "existing", label: tv("approve_existing") },
              ]}
            />
          )}
          {mode === "new" ? (
            <Field label={tv("f_project")} icon={ICON.project} required error={error("name")}>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clear("name");
                }}
                placeholder={tv("f_project_ph")}
              />
            </Field>
          ) : (
            <Field label={tv("f_project")} icon={ICON.project} required error={error("project")}>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  clear("project");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tv("approve_pick_project")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label={tv("f_designers")} icon={ICON.designer} hint={tv("f_designers_hint")}>
            <DesignerPick
              value={designerIds}
              onChange={setDesignerIds}
              candidates={designerCandidates}
              labels={{ add: tv("designers_add"), none: tv("designers_none"), remove: tv("designers_remove"), turn: tv("designers_turn") }}
            />
          </Field>
          {open_.length > 0 && (
            <QuotePickList
              quotes={open_}
              picked={picked}
              onToggle={(id) => {
                clear("quotes");
                setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
              }}
              label={tv("approve_which_quotes")}
              hint={tv("approve_which_hint")}
              error={error("quotes")}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void requestClose()}>
            {tv("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => void approve()}>
            {saving ? tv("saving") : tv("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
