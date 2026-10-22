"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

import type { Contractor } from "@/types/contractors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateContractorAction, zeroContractorBalanceAction } from "./actions";
import { Field } from "./field";

/**
 * Inactivar / liquidar un contratista: pasa a INACTIVE con fecha de
 * salida + notas. Conserva toda la historia (aparece luego en "Ya no
 * laboran"). Si el saldo no es cero hay que decidir qué hacer con él:
 * dejarlo pendiente (se paga o se cobra después) o cerrarlo en cero con un
 * ajuste a la fecha de salida (`zero_contractor_balance`: también salda la
 * retención y termina sus contratos). Es la única puerta para dejar un
 * saldo en cero.
 */
export function ContractorLiquidationDialog({
  contractor,
  balanceCents,
  open,
  onOpenChange,
  onSaved,
}: {
  contractor: Contractor;
  balanceCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const isEditing = contractor.status === "INACTIVE";
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [endDate, setEndDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  // Con saldo distinto de cero no hay opción por defecto: se elige a mano.
  const [balanceAction, setBalanceAction] = React.useState<"keep" | "zero" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el contratista cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setEndDate(contractor.endDate ?? today);
    setNotes(contractor.notes ?? "");
    setBalanceAction(null);
    setError(null);
  }, [open, contractor, today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!endDate) {
      setError(tt("liq_f_end_date_required"));
      return;
    }
    if (balanceCents !== 0 && !balanceAction) {
      setError(tt("liq_balance_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (balanceCents !== 0 && balanceAction === "zero") {
        const res = await zeroContractorBalanceAction(contractor.id, endDate, tt("liq_zero_note"));
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      await updateContractorAction(contractor.id, {
        status: "INACTIVE",
        endDate,
        notes: notes.trim() || null,
      });
      toast.success(tt("liq_done"));
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tt("liq_dlg_title")}</DialogTitle>
          <DialogDescription>
            {contractor.name} — {tt("liq_dlg_desc")}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          {balanceCents !== 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {tt("liq_balance_warning_title")}: {formatCents(balanceCents)}
                  </span>{" "}
                  ({balanceCents > 0 ? tt("bal_ebony_owes") : tt("bal_owes_ebony")}). {tt("liq_balance_question")}
                </span>
              </div>
              {(
                [
                  ["keep", tt("liq_balance_keep"), tt("liq_balance_keep_desc")],
                  ["zero", tt("liq_balance_zero"), tt("liq_balance_zero_desc")],
                ] as const
              ).map(([value, title, desc]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    balanceAction === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="balance-action"
                    className="mt-1"
                    checked={balanceAction === value}
                    onChange={() => setBalanceAction(value)}
                  />
                  <span>
                    <span className="font-medium text-foreground">{title}</span>
                    <span className="block text-xs text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <Field label={tt("liq_f_end_date")}>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label={tt("liq_f_notes")}>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? tt("saving") : isEditing ? tt("action_save") : tt("liq_mark")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
