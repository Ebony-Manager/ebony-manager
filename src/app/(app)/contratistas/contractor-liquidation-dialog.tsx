"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { updateContractorAction } from "./actions";
import { Field } from "./field";

/**
 * Inactivar / liquidar un contratista: pasa a INACTIVE con fecha de
 * salida + notas. Conserva toda la historia y el saldo (aparece luego en
 * "Ya no laboran"). Si el saldo no es cero, se advierte antes de
 * confirmar — inactivar no salda la cuenta.
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
  const router = useRouter();

  const isEditing = contractor.status === "INACTIVE";
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [endDate, setEndDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el contratista cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setEndDate(contractor.endDate ?? today);
    setNotes(contractor.notes ?? "");
    setError(null);
  }, [open, contractor, today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!endDate) {
      setError(tt("liq_f_end_date_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateContractorAction(contractor.id, {
        status: "INACTIVE",
        endDate,
        notes: notes.trim() || null,
      });
      toast.success(tt("liq_done"));
      onOpenChange(false);
      onSaved?.();
      router.refresh();
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
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {tt("liq_balance_warning_title")}: {formatCents(balanceCents)}.
                </span>{" "}
                {tt("liq_balance_warning")}
              </span>
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
