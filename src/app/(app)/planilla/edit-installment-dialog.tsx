"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { Period } from "@/lib/planilla/payroll-period";
import { formatCents } from "@/lib/planilla/payroll-period";
import { MoneyInput } from "@/components/ui/money-input";
import { monthShort } from "@/lib/planilla/format";
import { currentPeriod, nextPeriod, previousPeriod, periodOrdinal } from "@/lib/planilla/payroll-period";
import { reflowLoanSchedule, type PendingInstallment, type ReflowMode } from "@/lib/planilla/payroll-loans";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { moveLoanInstallmentAction, reflowLoanInstallmentAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

/**
 * Edita el monto de UNA cuota pendiente de un préstamo — dejarlo en $0 la
 * salta. La suma de lo que falta por pagar nunca cambia: lo que sobra o falta
 * de esta cuota se acomoda en las demás de la forma que elijas:
 *   · "extend": las cuotas que siguen quedan igual y la diferencia va a una
 *     quincena nueva al final (o acorta el préstamo si pagas de más);
 *   · "spread": la diferencia se reparte en partes iguales entre las cuotas
 *     que quedan, sin cambiar cuántas son.
 * Una cuota ya pagada nunca llega a este diálogo.
 */
export function EditInstallmentDialog({
  loanId,
  employeeId,
  ledgerEntryId,
  pending,
  open,
  onOpenChange,
  onSaved,
}: {
  loanId: string;
  employeeId: string;
  /** null mientras no hay nada seleccionado — el diálogo no se abre. */
  ledgerEntryId: string | null;
  /** Todas las cuotas PENDIENTES del préstamo (incluida la que se edita). */
  pending: PendingInstallment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const current = pending.find((p) => p.ledgerEntryId === ledgerEntryId) ?? null;

  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<ReflowMode>("extend");
  const [periodKey, setPeriodKey] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; la cuota editada cambia entre aperturas. */
  React.useEffect(() => {
    if (!open || !current) return;
    setAmount((current.amountCents / 100).toFixed(2));
    setPeriodKey(`${current.period.year}-${current.period.month}-${current.period.half}`);
    setMode("extend");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo importa al abrir.
  }, [open, ledgerEntryId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const raw = parseFloat(amount || "0");
  const cents = Number.isFinite(raw) ? Math.max(0, Math.round(raw * 100)) : 0;

  const preview = React.useMemo(() => {
    if (!current) return { extend: [], spread: [] };
    try {
      return {
        extend: reflowLoanSchedule(pending, current.ledgerEntryId, cents, "extend"),
        spread: reflowLoanSchedule(pending, current.ledgerEntryId, cents, "spread"),
      };
    } catch {
      return { extend: [], spread: [] };
    }
  }, [pending, current, cents]);

  const changed = current ? cents !== current.amountCents : false;
  const same = preview.extend.map((i) => i.amountCents).join() === preview.spread.map((i) => i.amountCents).join();
  const shown = mode === "spread" ? preview.spread : preview.extend;
  const pl = (p: Period) => `${monthShort(lang, p.month)} ${p.year} · ${p.half === 1 ? "1ra" : "2da"}`;
  const periods = React.useMemo(() => {
    if (!current) return [];
    const now = currentPeriod();
    const result: Period[] = [];
    let period = previousPeriod(now.year, now.month, now.half);
    for (let i = 0; i < 30; i++) {
      result.push(period);
      period = nextPeriod(period);
    }
    if (!result.some((p) => `${p.year}-${p.month}-${p.half}` === `${current.period.year}-${current.period.month}-${current.period.half}`)) {
      result.push(current.period);
    }
    return result.sort((a, b) => periodOrdinal(a.year, a.month, a.half) - periodOrdinal(b.year, b.month, b.half));
  }, [current]);
  const selectedPeriod = periods.find((p) => `${p.year}-${p.month}-${p.half}` === periodKey) ?? null;

  async function onSubmit() {
    if (!ledgerEntryId) return;
    setSubmitting(true);
    setError(null);
    try {
      if (current && selectedPeriod && (selectedPeriod.year !== current.period.year || selectedPeriod.month !== current.period.month || selectedPeriod.half !== current.period.half)) {
        await moveLoanInstallmentAction({ loanId, ledgerEntryId, period: selectedPeriod });
      }
      if (current && cents !== current.amountCents) {
        await reflowLoanInstallmentAction({ loanId, employeeId, ledgerEntryId, newAmountCents: cents, mode });
      }
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
      wide
    >
      {current && <p className="text-sm text-muted-foreground">{pl(current.period)}</p>}
      <Field label={tt("loan_edit_f_period")}>
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-64">
            {periods.map((p) => {
              const key = `${p.year}-${p.month}-${p.half}`;
              return <SelectItem key={key} value={key}>{pl(p)}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </Field>
      <Field label={tt("loan_edit_f_amount")}>
        <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
      </Field>
      <p className="text-xs text-muted-foreground">{tt("loan_edit_amount_hint")}</p>

      {changed && !same && (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-foreground">{tt("loan_edit_mode_title")}</legend>
          {(["extend", "spread"] as const).map((m) => (
            <label key={m} className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="reflow-mode"
                className="mt-1"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              <span>
                {tt(m === "extend" ? "loan_edit_mode_extend" : "loan_edit_mode_spread")}
                <span className="block text-xs text-muted-foreground">
                  {(m === "extend" ? preview.extend : preview.spread).map((i) => formatCents(i.amountCents)).join(" · ")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {changed && shown.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{tt("loan_edit_preview")}</p>
          <ul className="flex flex-col gap-0.5">
            {shown.map((i, idx) => (
              <li key={i.ledgerEntryId ?? `new-${idx}`} className="flex justify-between gap-3">
                <span>{pl(i.period)}</span>
                <span className="tabular-nums text-foreground">{formatCents(i.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {changed && same && <p className="text-xs text-muted-foreground">{tt("loan_edit_no_change")}</p>}
    </FormDialog>
  );
}
