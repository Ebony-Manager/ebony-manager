"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { useLang } from "@/context/language-context";
import { strings, t } from "@/lib/i18n";
import { LOST_REASONS, type LostReason } from "@/types/ventas";
import type { Quote, QuoteOwnerOptions, QuoteSibling } from "@/types/cotizador";
import { Field } from "../../contratistas/field";
import { useTv } from "../ventas-common";

type Tk = keyof typeof strings.cotizador;
const isOpen = (s: QuoteSibling) =>
  s.status === "BORRADOR" || s.status === "ENVIADA";

export interface ApproveChoice {
  projectName: string | null;
  projectId: string | null;
}

/**
 * Aprobar. De una oportunidad: crea el proyecto (o lo enlaza a uno que ya
 * existe) y avisa qué versiones abiertas quedan rechazadas. De un proyecto o
 * de solo cliente: solo se confirma.
 */
export function ApproveQuoteDialog({
  quote,
  open,
  siblings,
  projects,
  onClose,
  onConfirm,
}: {
  quote: Quote;
  open: boolean;
  siblings: QuoteSibling[];
  projects: QuoteOwnerOptions["projects"];
  onClose: () => void;
  onConfirm: (choice: ApproveChoice) => Promise<void>;
}) {
  const { lang } = useLang();
  const tt = (k: Tk) => t(lang, strings.cotizador[k]);
  const { tv } = useTv();
  const [mode, setMode] = React.useState<"new" | "existing">("new");
  const [name, setName] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMode("new");
    setName(
      quote.projectName.split(" · ")[0] ||
        quote.clientName ||
        quote.designerName,
    );
    setProjectId("");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fromOpp = !!quote.opportunityId;
  const project = projects.find((p) => p.id === quote.projectId);
  const closing = fromOpp ? siblings.filter(isOpen) : [];
  const ready = !fromOpp || (mode === "new" ? !!name.trim() : !!projectId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tt("st_approve_title")}</DialogTitle>
          <DialogDescription>
            {fromOpp
              ? tt("st_approve_opp")
              : project
                ? `${tt("st_approve_project")} ${project.name}.`
                : tt("st_approve_simple")}
          </DialogDescription>
        </DialogHeader>
        {fromOpp && (
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
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tv("f_project_ph")}
                />
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
            {closing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {tt("st_approve_siblings")}{" "}
                {closing.map((s) => s.number).join(", ")}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tv("cancel")}
          </Button>
          <Button
            disabled={saving || !ready}
            onClick={async () => {
              setSaving(true);
              await onConfirm(
                fromOpp
                  ? {
                      projectName: mode === "new" ? name.trim() : null,
                      projectId: mode === "existing" ? projectId : null,
                    }
                  : { projectName: null, projectId: null },
              );
              setSaving(false);
            }}
          >
            {saving ? tv("saving") : tt("st_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rechazar. Si es la última versión abierta de una oportunidad, la
 * oportunidad pasa a Perdida y el motivo es obligatorio.
 */
export function RejectQuoteDialog({
  quote,
  open,
  siblings,
  onClose,
  onConfirm,
}: {
  quote: Quote;
  open: boolean;
  siblings: QuoteSibling[];
  onClose: () => void;
  onConfirm: (reason: LostReason | null, note: string | null) => Promise<void>;
}) {
  const { lang } = useLang();
  const tt = (k: Tk) => t(lang, strings.cotizador[k]);
  const { tv } = useTv();
  const [reason, setReason] = React.useState<LostReason | "">("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setSaving(false);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const stillOpen = quote.opportunityId ? siblings.filter(isOpen) : [];
  const needsReason = !!quote.opportunityId && stillOpen.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tt("st_reject_title")}</DialogTitle>
          <DialogDescription>
            {needsReason
              ? tt("st_reject_lost")
              : stillOpen.length > 0
                ? `${tt("st_reject_open")} ${stillOpen.map((s) => s.number).join(", ")}`
                : tt("st_reject_simple")}
          </DialogDescription>
        </DialogHeader>
        {needsReason && (
          <div className="flex flex-col gap-4">
            <Field label={tv("f_lost_reason")}>
              <Select
                value={reason}
                onValueChange={(v) => setReason(v as LostReason)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tv("f_lost_reason")} />
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
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tv("optional")}
              />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tv("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={saving || (needsReason && !reason)}
            onClick={async () => {
              setSaving(true);
              await onConfirm(
                needsReason ? (reason as LostReason) : null,
                needsReason ? note.trim() || null : null,
              );
              setSaving(false);
            }}
          >
            {saving ? tv("saving") : tt("st_reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
