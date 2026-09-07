"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import type { LoanPaymentMethod } from "@/types/planilla";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentPeriod, nextPeriod, formatCents, type Period } from "@/lib/planilla/payroll-period";
import { computeLoanSchedule, defaultLoanStartPeriod, loanPayoffPeriod } from "@/lib/planilla/payroll-loans";
import { periodLabel } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLoanAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

function periodKeyOf(p: Period): string {
  return `${p.year}-${p.month}-${p.half}`;
}

/** Las próximas ~16 quincenas desde hoy — lista sintética (las
 *  quincenas futuras pueden no tener fila todavía; createLoan las
 *  materializa). */
function upcomingPeriods(): Period[] {
  let p: Period = currentPeriod();
  const periods: Period[] = [p];
  for (let i = 0; i < 15; i++) {
    p = nextPeriod(p);
    periods.push(p);
  }
  return periods;
}

export function LoanDialog({
  employeeId,
  defaultCategory,
  open,
  onOpenChange,
  onSaved,
}: {
  employeeId: string;
  defaultCategory: "prestamo" | "adelanto";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();

  const periods = React.useMemo(() => upcomingPeriods(), []);
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pLabel = (p: Period) => periodLabel(lang, p, tt("quincena_1"), tt("quincena_2"));

  const [category, setCategory] = React.useState<"prestamo" | "adelanto">(defaultCategory);
  const [amount, setAmount] = React.useState("");
  const [requestDate, setRequestDate] = React.useState(today);
  const [numInstallments, setNumInstallments] = React.useState("1");
  const [startPeriodKey, setStartPeriodKey] = React.useState(() =>
    periodKeyOf(defaultLoanStartPeriod(defaultCategory, today) ?? periods[0])
  );
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setCategory(defaultCategory);
    setAmount("");
    setRequestDate(today);
    setNumInstallments("1");
    setStartPeriodKey(periodKeyOf(defaultLoanStartPeriod(defaultCategory, today) ?? periods[0]));
    setNotes("");
    setError(null);
  }, [open, defaultCategory, today, periods]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Re-deriva la quincena de inicio cuando cambia el tipo o la fecha.
  /* eslint-disable react-hooks/set-state-in-effect -- deriva de category/requestDate, no del propio startPeriodKey. */
  React.useEffect(() => {
    const def = defaultLoanStartPeriod(category, requestDate);
    if (def) setStartPeriodKey(periodKeyOf(def));
    if (category === "adelanto") setNumInstallments("1");
  }, [category, requestDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isAdelanto = category === "adelanto";
  const n = isAdelanto ? 1 : Math.max(1, parseInt(numInstallments || "1", 10) || 1);
  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const startPeriod = periods.find((p) => periodKeyOf(p) === startPeriodKey) ?? periods[0];
  const schedule = amountCents > 0 ? computeLoanSchedule(amountCents, n, startPeriod) : [];
  const payoff = loanPayoffPeriod(startPeriod, n);

  async function onSubmit() {
    if (amountCents <= 0) {
      setError(tt("loan_f_amount_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createLoanAction({
        employeeId,
        category,
        principalCents: amountCents,
        paymentMethod: "cuota_fija" as LoanPaymentMethod,
        requestDate,
        numInstallments: n,
        startPeriod,
        notes: notes.trim() || null,
      });
      toast.success(isAdelanto ? tt("loan_submit_adelanto") : tt("loan_submit_prestamo"));
      onOpenChange(false);
      onSaved();
      router.refresh();
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
      title={isAdelanto ? tt("loan_dlg_adelanto_title") : tt("loan_dlg_prestamo_title")}
      description={isAdelanto ? tt("loan_dlg_adelanto_desc") : tt("loan_dlg_prestamo_desc")}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={isAdelanto ? tt("loan_submit_adelanto") : tt("loan_submit_prestamo")}
      error={error}
      wide
    >
      <Field label={tt("loan_f_type")}>
        <Select value={category} onValueChange={(v) => setCategory(v as "prestamo" | "adelanto")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prestamo">{tt("loan_type_prestamo")}</SelectItem>
            <SelectItem value="adelanto">{tt("loan_type_adelanto")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tt("loan_f_amount")}>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label={tt("loan_f_request_date")}>
          <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
        </Field>
      </div>

      {!isAdelanto && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={tt("loan_f_installments")}>
            <Input
              type="number"
              min="1"
              step="1"
              value={numInstallments}
              onChange={(e) => setNumInstallments(e.target.value)}
            />
          </Field>
          <Field label={tt("loan_f_scheme")}>
            <Select value="cuota_fija" disabled>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cuota_fija">{tt("loan_scheme_fija")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <Field label={isAdelanto ? tt("loan_f_deduct_period") : tt("loan_f_first_period")}>
        <Select value={startPeriodKey} onValueChange={setStartPeriodKey}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={periodKeyOf(p)} value={periodKeyOf(p)}>
                {pLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{tt("loan_period_hint")}</p>
      </Field>

      {amountCents > 0 && schedule.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          {isAdelanto ? (
            <p>
              {tt("loan_preview_adelanto")}{" "}
              <span className="font-medium text-foreground">{formatCents(amountCents)}</span> —{" "}
              <span className="font-medium text-foreground">{pLabel(startPeriod)}</span>.
            </p>
          ) : (
            <>
              <p>
                <span className="font-medium text-foreground">{n}</span> {tt("loan_preview_installments")}{" "}
                <span className="font-medium text-foreground">{formatCents(schedule[0].amountCents)}</span>
                {schedule[schedule.length - 1].amountCents !== schedule[0].amountCents && (
                  <>
                    {" "}
                    ({tt("loan_preview_last")}{" "}
                    <span className="font-medium text-foreground">
                      {formatCents(schedule[schedule.length - 1].amountCents)}
                    </span>
                    )
                  </>
                )}
                , {tt("loan_preview_starting")} {pLabel(startPeriod)}.
              </p>
              <p className="mt-1">
                {tt("loan_preview_payoff")} <span className="font-medium text-foreground">{pLabel(payoff)}</span>
              </p>
            </>
          )}
        </div>
      )}

      <Field label={tt("mov_f_notes")}>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
