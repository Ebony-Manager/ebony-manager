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
import { useDiscardGuard } from "@/components/shared/discard-guard";
import { useFormErrors } from "@/lib/ui/use-form-errors";
import { ICON } from "@/lib/ui/concepts";
import { useTv } from "../ventas-common";
import { QuotePickList } from "../seguimiento/stage-dialogs";
import { DesignerPick } from "@/components/shared/designer-pick";
import type { DesignerCandidate } from "@/types/designers";

type Tk = keyof typeof strings.cotizador;
const isOpen = (s: QuoteSibling) =>
  s.status === "BORRADOR" || s.status === "ENVIADA";

export interface ApproveChoice {
  projectName: string | null;
  projectId: string | null;
  /** Otras de la misma oportunidad que el cliente también aprobó. */
  also: string[];
  designerIds: string[];
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
  designerCandidates,
  onClose,
  onConfirm,
}: {
  quote: Quote;
  open: boolean;
  siblings: QuoteSibling[];
  projects: QuoteOwnerOptions["projects"];
  designerCandidates: DesignerCandidate[];
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
  const [also, setAlso] = React.useState<string[]>([]);
  const [designerIds, setDesignerIds] = React.useState<string[]>([]);
  const { error, validate, clear, reset } = useFormErrors<"name" | "project">();
  const initial = React.useRef("");
  const snapshot = () => JSON.stringify({ mode, name, projectId, also, designerIds });
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => snapshot() !== initial.current, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- formulario nuevo al abrir. */
  React.useEffect(() => {
    if (!open) return;
    const startName = quote.projectName.split(" · ")[0] || quote.designerName || quote.clientName;
    // Proyecto nuevo: viene marcada la diseñadora a quien le toca (turno); se puede cambiar.
    const turn = designerCandidates.find((c) => c.turnRank === 1)?.id;
    const startDesigners = turn ? [turn] : [];
    setAlso([]);
    setDesignerIds(startDesigners);
    setMode("new");
    setName(startName);
    initial.current = JSON.stringify({ mode: "new", name: startName, projectId: "", also: [], designerIds: startDesigners });
    setProjectId("");
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

  const fromOpp = !!quote.opportunityId;
  const project = projects.find((p) => p.id === quote.projectId);
  // Las otras abiertas de la misma oportunidad: se marcan las que también se aprobaron.
  const others = fromOpp ? siblings.filter((s) => isOpen(s) && s.opportunityId === quote.opportunityId) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
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
            {others.length > 0 && (
              <QuotePickList
                quotes={others}
                picked={also}
                onToggle={(id) => setAlso((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))}
                label={tt("st_approve_also")}
                hint={tv("approve_which_hint")}
              />
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => void requestClose()}>
            {tv("cancel")}
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (
                fromOpp &&
                !validate([
                  ["name", mode === "new" && !name.trim(), tv("approve_name_required")],
                  ["project", mode === "existing" && !projectId, tv("approve_project_required")],
                ])
              )
                return;
              setSaving(true);
              await onConfirm(
                fromOpp
                  ? {
                      projectName: mode === "new" ? name.trim() : null,
                      projectId: mode === "existing" ? projectId : null,
                      also,
                      designerIds,
                    }
                  : { projectName: null, projectId: null, also: [], designerIds: [] },
              );
              setSaving(false);
            }}
          >
            {saving ? tv("saving") : tt("st_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
      {discardDialog}
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
  const { error, validate, clear, reset } = useFormErrors<"reason">();
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

  const stillOpen = quote.opportunityId ? siblings.filter(isOpen) : [];
  const needsReason = !!quote.opportunityId && stillOpen.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void requestClose()}>
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
            <Field label={tv("f_lost_reason")} required error={error("reason")}>
              <Select
                value={reason}
                onValueChange={(v) => {
                  setReason(v as LostReason);
                  clear("reason");
                }}
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
              />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => void requestClose()}>
            {tv("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={async () => {
              if (needsReason && !validate([["reason", !reason, tv("lost_reason_required")]])) return;
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
      {discardDialog}
    </Dialog>
  );
}

/**
 * Antes de mandar una cotización (marcarla enviada o bajar el PDF de un borrador) se reconfirman los días hábiles
 * de entrega: es el dato que más se queda sin ajustar y sale en el PDF que recibe el cliente. Se puede cambiar ahí mismo.
 */
export function DeliveryCheckDialog({
  mode,
  days,
  onClose,
  onConfirm,
}: {
  /** null = cerrado. */
  mode: "send" | "pdf" | null;
  days: number;
  onClose: () => void;
  onConfirm: (days: number) => Promise<void>;
}) {
  const { lang } = useLang();
  const tt = (k: Tk) => t(lang, strings.cotizador[k]);
  const { tv } = useTv();
  const [value, setValue] = React.useState(String(days));
  const [saving, setSaving] = React.useState(false);
  const { error, validate, clear, reset } = useFormErrors<"days">();
  const { requestClose, dialog: discardDialog } = useDiscardGuard(() => value !== String(days), onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- el valor de la cotización al abrir. */
  React.useEffect(() => {
    if (!mode) return;
    setValue(String(days));
    setSaving(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const n = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(n) && n > 0 && n <= 365;

  async function submit() {
    if (!validate([["days", !valid, tt("dc_days_invalid")]])) return;
    setSaving(true);
    await onConfirm(n);
    setSaving(false);
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && void requestClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{tt("dc_title")}</DialogTitle>
          <DialogDescription>{tt("dc_desc")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={tt("f_delivery")} icon={ICON.date} error={error("days")} hint={valid && n !== days ? `${tt("dc_changed")} ${days} → ${n}` : undefined}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                autoFocus
                className="w-24 text-right tabular-nums"
                value={value}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  setValue(e.target.value);
                  clear("days");
                }}
              />
              <span className="text-sm text-muted-foreground">{tt("unit_days")}</span>
            </div>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()}>
              {tv("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? tv("saving") : mode === "pdf" ? tt("dc_confirm_pdf") : tt("dc_confirm_send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
