"use client";

import * as React from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import { LOST_REASONS, type Client, type LostReason, type Opportunity } from "@/types/ventas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { openQuotes, opportunityTitle } from "@/lib/ventas/opportunities";
import { formatMoney } from "@/lib/cotizador/pricing";
import { cn } from "@/lib/utils";
import { Field } from "../../contratistas/field";
import { projectPath } from "../../proyectos/paths";
import { approveOpportunityAction } from "../ventas-actions";
import { useTv } from "../ventas-common";
import type { SalesProject } from "./opportunity-dialog";

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
  const open = opportunity !== null;

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setSaving(false);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tv("move_to")} {tv("stage_perdida")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={tv("f_lost_reason")}>
            <Select value={reason} onValueChange={(v) => setReason(v as LostReason)}>
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
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tv("optional")} />
          </Field>
          {opportunity && openQuotes(opportunity.quotes).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {tv("lost_quotes_rejected")} {openQuotes(opportunity.quotes).map((q) => q.number).join(", ")}
            </p>
          )}
          {opportunity?.driveFolderId && !opportunity.projectId && <p className="text-xs text-destructive">{tv("lost_drive_warning")}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tv("cancel")}
          </Button>
          <Button
            disabled={!reason || saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm(reason as LostReason, note.trim() || null);
            }}
          >
            {saving ? tv("saving") : tv("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
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
}: {
  quotes: { id: string; number: string; status: string; total: number }[];
  picked: string[];
  onToggle: (id: string) => void;
  label: string;
  hint: string;
}) {
  const { tv } = useTv();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      {quotes.map((q) => {
        const on = picked.includes(q.id);
        return (
          <label
            key={q.id}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm", on ? "border-primary bg-primary/5" : "border-border hover:border-ring")}
          >
            <input type="checkbox" checked={on} onChange={() => onToggle(q.id)} className="size-4 accent-primary" />
            <span className="font-medium tabular-nums">{q.number}</span>
            <span className="text-xs text-muted-foreground">{tv(q.status === "ENVIADA" ? "quote_sent" : "quote_draft")}</span>
            <span className="ml-auto font-semibold tabular-nums">{formatMoney(q.total)}</span>
          </label>
        );
      })}
      <p className="text-xs text-muted-foreground">{hint}</p>
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
  onClose,
}: {
  opportunity: Opportunity | null;
  clients: Map<string, Client>;
  projects: SalesProject[];
  onClose: () => void;
}) {
  const { tv } = useTv();
  const open = opportunity !== null;
  const [mode, setMode] = React.useState<"new" | "existing">("new");
  const [name, setName] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<string[]>([]);
  const open_ = opportunity ? openQuotes(opportunity.quotes) : [];

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!opportunity) return;
    // Con una sola cotización abierta, viene marcada.
    const abiertas = openQuotes(opportunity.quotes);
    setPicked(abiertas.length === 1 ? [abiertas[0].id] : []);
    setMode(opportunity.projectId ? "existing" : "new");
    setName(opportunityTitle(opportunity, clients));
    setProjectId(opportunity.projectId ?? "");
    setSaving(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function approve() {
    if (!opportunity) return;
    setSaving(true);
    setError(null);
    const res = await approveOpportunityAction(opportunity.id, mode === "new" ? name.trim() : null, mode === "existing" ? projectId : null, picked);
    setSaving(false);
    if (!res.ok) return setError(res.error);
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
              onChange={setMode}
              options={[
                { value: "new", label: tv("approve_new_project") },
                { value: "existing", label: tv("approve_existing") },
              ]}
            />
          )}
          {mode === "new" ? (
            <Field label={tv("f_project")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tv("f_project_ph")} />
            </Field>
          ) : (
            <Field label={tv("f_project")}>
              <Select value={projectId} onValueChange={setProjectId}>
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
          {open_.length > 0 && (
            <QuotePickList
              quotes={open_}
              picked={picked}
              onToggle={(id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))}
              label={tv("approve_which_quotes")}
              hint={tv("approve_which_hint")}
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tv("cancel")}
          </Button>
          <Button disabled={saving || (mode === "new" ? !name.trim() : !projectId) || (open_.length > 0 && picked.length === 0)} onClick={() => void approve()}>
            {saving ? tv("saving") : tv("approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
