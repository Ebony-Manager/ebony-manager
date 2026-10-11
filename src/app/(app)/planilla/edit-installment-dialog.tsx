"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { Period } from "@/lib/planilla/payroll-period";
import { Input } from "@/components/ui/input";
import { monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { reflowLoanInstallmentAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

/**
 * Edita el monto de UNA cuota pendiente de un préstamo (Taller · Tanda
 * 4/6) — dejarlo en $0 la salta. El resto del calendario se reacomoda
 * solo (`reflowLoanInstallmentAction` → `reflowLoanSchedule`, puro) para
 * que la suma de lo que falta siga cuadrando con el saldo pendiente. Una
 * cuota ya pagada nunca llega a este diálogo.
 */
export function EditInstallmentDialog({
  loanId,
  employeeId,
  ledgerEntryId,
  period,
  currentAmountCents,
  open,
  onOpenChange,
  onSaved,
}: {
  loanId: string;
  employeeId: string;
  /** null mientras no hay nada seleccionado — el diálogo no se abre. */
  ledgerEntryId: string | null;
  period: Period | null;
  currentAmountCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [amount, setAmount] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; la cuota editada cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setAmount((currentAmountCents / 100).toFixed(2));
    setError(null);
  }, [open, currentAmountCents]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit() {
    if (!ledgerEntryId) return;
    const raw = parseFloat(amount || "0");
    const cents = Number.isFinite(raw) ? Math.max(0, Math.round(raw * 100)) : 0;
    setSubmitting(true);
    setError(null);
    try {
      await reflowLoanInstallmentAction({ loanId, employeeId, ledgerEntryId, newAmountCents: cents });
      toast.success(tt("loan_edit_saved"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={tt("loan_edit_dlg_title")}
      description={tt("loan_edit_dlg_desc")}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={tt("action_save")}
      error={error}
    >
      {period && (
        <p className="text-sm text-muted-foreground">
          {monthShort(lang, period.month)} {period.year} · {period.half === 1 ? "1ra" : "2da"}
        </p>
      )}
      <Field label={tt("loan_edit_f_amount")}>
        <Input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          autoFocus
        />
      </Field>
      <p className="text-xs text-muted-foreground">{tt("loan_edit_amount_hint")}</p>
    </FormDialog>
  );
}
