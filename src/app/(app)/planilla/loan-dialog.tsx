"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { LoanCategory, LoanInterestMode, LoanPaymentMethod, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  currentPeriod,
  formatCents,
  nextPeriod,
  periodOrdinal,
  previousPeriod,
  type Period,
} from "@/lib/planilla/payroll-period";
import {
  computeLoanInterestCents,
  computeLoanSchedule,
  defaultLoanStartPeriod,
  loanPayoffPeriod,
} from "@/lib/planilla/payroll-loans";
import { periodLabel, shortPeriodLabel } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLoanAction, replaceLoanAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

function periodKeyOf(p: Period): string {
  return `${p.year}-${p.month}-${p.half}`;
}

/** Quincenas para elegir cuándo empieza el descuento: un par hacia atrás (por
 *  si se registra algo con retraso), las próximas ~16 y, al editar, la que ya
 *  tenía el registro aunque quede fuera de ese rango. */
function selectablePeriods(extra?: Period): Period[] {
  const now = currentPeriod();
  let p: Period = previousPeriod(now.year, now.month, now.half);
  p = previousPeriod(p.year, p.month, p.half);
  const periods: Period[] = [p];
  for (let i = 0; i < 18; i++) {
    p = nextPeriod(p);
    periods.push(p);
  }
  if (extra && !periods.some((x) => periodKeyOf(x) === periodKeyOf(extra))) {
    periods.push(extra);
    periods.sort((a, b) => periodOrdinal(a.year, a.month, a.half) - periodOrdinal(b.year, b.month, b.half));
  }
  return periods;
}

const CATEGORY_LABEL: Record<LoanCategory, keyof typeof strings.planilla> = {
  prestamo: "loan_type_prestamo",
  adelanto: "loan_type_adelanto",
  herramienta: "loan_type_herramienta",
  dano: "loan_type_dano",
};

const TITLE_KEY: Record<LoanCategory, keyof typeof strings.planilla> = {
  prestamo: "loan_dlg_prestamo_title",
  adelanto: "loan_dlg_adelanto_title",
  herramienta: "loan_dlg_herramienta_title",
  dano: "loan_dlg_dano_title",
};

const SUBMIT_KEY: Record<LoanCategory, keyof typeof strings.planilla> = {
  prestamo: "loan_submit_prestamo",
  adelanto: "loan_submit_adelanto",
  herramienta: "loan_submit_herramienta",
  dano: "loan_submit_dano",
};

/** Reparte `total` en `n` partes (el sobrante de la división va a la última). */
function splitEvenly(total: number, n: number): number[] {
  if (n < 1) return [];
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? base + rest : base));
}

const toCentsStr = (c: number) => (c / 100).toFixed(2);
const parseCents = (s: string) => {
  const v = Math.round(parseFloat(s || "0") * 100);
  return Number.isFinite(v) ? v : 0;
};

/**
 * Alta (o edición) de un préstamo, adelanto, herramienta o daño. Tiene dos
 * formas de pago: cuota fija (partes iguales) y cuota variable (el monto de
 * cada quincena se escribe a mano y debe sumar el total). Al editar se rehace
 * el calendario completo (solo si no hay cuotas pagadas).
 */
export function LoanDialog({
  employeeId,
  categories,
  defaultCategory,
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  employeeId: string;
  /** Tipos que se pueden elegir en este diálogo. */
  categories: LoanCategory[];
  defaultCategory: LoanCategory;
  /** Si viene, se edita ese registro en vez de crear uno. */
  editing?: PayrollLoanWithSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const periods = React.useMemo(() => selectablePeriods(editing?.startPeriod), [editing]);
  const pLabel = (p: Period) => periodLabel(lang, p, tt("quincena_1"), tt("quincena_2"));

  const [category, setCategory] = React.useState<LoanCategory>(defaultCategory);
  const [amount, setAmount] = React.useState("");
  const [requestDate, setRequestDate] = React.useState(today);
  const [numInstallments, setNumInstallments] = React.useState("1");
  const [scheme, setScheme] = React.useState<LoanPaymentMethod>("cuota_fija");
  const [startPeriodKey, setStartPeriodKey] = React.useState("");
  const [amounts, setAmounts] = React.useState<string[]>([]);
  const [touched, setTouched] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [interestOn, setInterestOn] = React.useState(false);
  const [interestMode, setInterestMode] = React.useState<LoanInterestMode>("monthly_pct");
  const [interestValue, setInterestValue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- (re)siembra al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      const sorted = [...editing.installments].sort(
        (a, b) =>
          periodOrdinal(a.period.year, a.period.month, a.period.half) -
          periodOrdinal(b.period.year, b.period.month, b.period.half)
      );
      setCategory(editing.category);
      setAmount(toCentsStr(editing.principalCents));
      setRequestDate(editing.requestDate);
      setNumInstallments(String(editing.numInstallments));
      setScheme(editing.paymentMethod);
      setStartPeriodKey(periodKeyOf(editing.startPeriod));
      setAmounts(sorted.map((i) => toCentsStr(i.amountCents)));
      setTouched(editing.paymentMethod === "cuota_variable");
      setNotes(editing.notes ?? "");
      setInterestOn(editing.interestCents > 0);
      setInterestMode(editing.interestMode ?? "fixed");
      setInterestValue(
        editing.interestCents <= 0
          ? ""
          : editing.interestMode === "fixed" || editing.interestRatePct === null
            ? toCentsStr(editing.interestCents)
            : String(editing.interestRatePct)
      );
    } else {
      setCategory(defaultCategory);
      setAmount("");
      setRequestDate(today);
      setNumInstallments("1");
      setScheme("cuota_fija");
      setStartPeriodKey(periodKeyOf(defaultLoanStartPeriod(defaultCategory, today) ?? periods[2]));
      setAmounts([]);
      setTouched(false);
      setNotes("");
      setInterestOn(false);
      setInterestMode("monthly_pct");
      setInterestValue("");
    }
  }, [open, editing, defaultCategory, today, periods]);

  // Re-deriva la quincena de inicio al cambiar el tipo o la fecha (solo al crear).
  React.useEffect(() => {
    if (!open || editing) return;
    const def = defaultLoanStartPeriod(category, requestDate);
    if (def) setStartPeriodKey(periodKeyOf(def));
    if (category === "adelanto") {
      setNumInstallments("1");
      setScheme("cuota_fija");
    }
  }, [open, editing, category, requestDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isAdelanto = category === "adelanto";
  const n = isAdelanto ? 1 : Math.max(1, Math.min(60, parseInt(numInstallments || "1", 10) || 1));
  const amountCents = parseCents(amount);
  const startPeriod = periods.find((p) => periodKeyOf(p) === startPeriodKey) ?? periods[2];
  const isVariable = scheme === "cuota_variable" && !isAdelanto;

  // Intereses (solo en dinero prestado, no en herramientas/daños).
  const canCharge = category === "prestamo" || category === "adelanto";
  const interestInput =
    canCharge && interestOn
      ? interestMode === "fixed"
        ? { mode: interestMode, fixedCents: parseCents(interestValue) }
        : { mode: interestMode, ratePct: parseFloat(interestValue || "0") || 0 }
      : null;
  const interestCents = computeLoanInterestCents(amountCents, n, interestInput);
  // Las cuotas pagan lo entregado más los intereses.
  const totalCents = amountCents + interestCents;

  // Cuota variable: mientras no se haya tocado nada a mano, se mantiene el
  // reparto en partes iguales al cambiar monto o número de cuotas.
  /* eslint-disable react-hooks/set-state-in-effect -- deriva del monto/cuotas. */
  React.useEffect(() => {
    if (!open || !isVariable) return;
    if (!touched) {
      setAmounts(splitEvenly(totalCents, n).map(toCentsStr));
    } else {
      setAmounts((prev) => (prev.length === n ? prev : Array.from({ length: n }, (_, i) => prev[i] ?? "0.00")));
    }
  }, [open, isVariable, touched, totalCents, n]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const variableCents = amounts.map(parseCents);
  const variableSum = variableCents.reduce((s, a) => s + a, 0);
  const variableDiff = totalCents - variableSum;
  const variableOk = variableCents.length === n && variableDiff === 0 && variableCents.every((a) => a > 0);

  let schedule: ReturnType<typeof computeLoanSchedule> = [];
  if (amountCents > 0 && startPeriod) {
    try {
      schedule = isVariable
        ? variableOk
          ? computeLoanSchedule(totalCents, n, startPeriod, "cuota_variable", variableCents)
          : []
        : computeLoanSchedule(totalCents, n, startPeriod);
    } catch {
      schedule = [];
    }
  }
  const payoff = startPeriod ? loanPayoffPeriod(startPeriod, n) : null;

  async function onSubmit() {
    if (amountCents <= 0) {
      setError(tt("loan_f_amount_required"));
      return;
    }
    if (isVariable && !variableOk) {
      setError(tt("loan_variable_mismatch"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        employeeId,
        category,
        principalCents: amountCents,
        paymentMethod: (isVariable ? "cuota_variable" : "cuota_fija") as LoanPaymentMethod,
        requestDate,
        numInstallments: n,
        startPeriod,
        installmentAmountsCents: isVariable ? variableCents : undefined,
        interest: interestInput,
        notes: notes.trim() || null,
      };
      const result = editing ? await replaceLoanAction(editing.id, input) : await createLoanAction(input);
      if (!result.ok) {
        setError(result.migrationPending ? tt("migration_pending") : result.error);
        return;
      }
      toast.success(editing ? tt("loan_updated") : tt(SUBMIT_KEY[category]));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const isItem = category === "herramienta" || category === "dano";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? tt("loan_dlg_edit_title") : tt(TITLE_KEY[category])}
      description={
        editing
          ? tt("loan_dlg_edit_desc")
          : isItem
            ? tt("loan_dlg_item_desc")
            : isAdelanto
              ? tt("loan_dlg_adelanto_desc")
              : tt("loan_dlg_prestamo_desc")
      }
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={editing ? tt("loan_save_changes") : tt(SUBMIT_KEY[category])}
      error={error}
      wide
    >
      {categories.length > 1 && (
        <Field label={tt("loan_f_type")}>
          <Select value={category} onValueChange={(v) => setCategory(v as LoanCategory)} disabled={Boolean(editing)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {tt(CATEGORY_LABEL[c])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={tt("loan_f_amount")}>
          <MoneyInput value={amount} onValueChange={setAmount} autoFocus />
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
              max="60"
              step="1"
              value={numInstallments}
              onChange={(e) => {
                setNumInstallments(e.target.value);
                setTouched(false);
              }}
            />
          </Field>
          <Field label={tt("loan_f_scheme")}>
            <Select
              value={scheme}
              onValueChange={(v) => {
                setScheme(v as LoanPaymentMethod);
                setTouched(false);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cuota_fija">{tt("loan_scheme_fija")}</SelectItem>
                <SelectItem value="cuota_variable">{tt("loan_scheme_variable")}</SelectItem>
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
          <SelectContent className="max-h-64">
            {periods.map((p) => (
              <SelectItem key={periodKeyOf(p)} value={periodKeyOf(p)}>
                {pLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{tt("loan_period_hint")}</p>
      </Field>

      {canCharge && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={interestOn} onChange={(e) => setInterestOn(e.target.checked)} />
            {tt("loan_interest_charge")}
          </label>
          {interestOn && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tt("loan_interest_how")}>
                  <Select
                    value={interestMode}
                    onValueChange={(v) => {
                      setInterestMode(v as LoanInterestMode);
                      setInterestValue("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly_pct">{tt("loan_interest_monthly")}</SelectItem>
                      <SelectItem value="total_pct">{tt("loan_interest_total")}</SelectItem>
                      <SelectItem value="fixed">{tt("loan_interest_fixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={interestMode === "fixed" ? tt("loan_interest_amount") : tt("loan_interest_rate")}>
                  <MoneyInput
                    symbol={interestMode === "fixed" ? "$" : "%"}
                    value={interestValue}
                    onValueChange={setInterestValue}
                    placeholder={interestMode === "fixed" ? "0.00" : "0"}
                  />
                </Field>
              </div>
              {amountCents > 0 && (
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{tt("loan_interest_principal")}</dt>
                    <dd className="font-medium tabular-nums text-foreground">{formatCents(amountCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{tt("loan_interest_label")}</dt>
                    <dd className="font-medium tabular-nums text-foreground">+ {formatCents(interestCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{tt("loan_interest_to_pay")}</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{formatCents(totalCents)}</dd>
                  </div>
                </dl>
              )}
              {interestMode === "monthly_pct" && (
                <p className="text-[11px] text-muted-foreground">{tt("loan_interest_monthly_hint")}</p>
              )}
            </>
          )}
        </div>
      )}

      {isVariable && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">{tt("loan_variable_title")}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setTouched(false);
                setAmounts(splitEvenly(totalCents, n).map(toCentsStr));
              }}
            >
              {tt("loan_variable_equal")}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {Array.from({ length: n }, (_, i) => {
              let p = startPeriod;
              for (let k = 0; k < i; k++) p = nextPeriod(p);
              return (
                <label key={i} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">{shortPeriodLabel(lang, p)}</span>
                  <div className="w-28">
                  <MoneyInput
                    className="h-8"
                    value={amounts[i] ?? ""}
                    onValueChange={(v) => {
                      setTouched(true);
                      setAmounts((prev) => {
                        const next = Array.from({ length: n }, (_, k) => prev[k] ?? "0.00");
                        next[i] = v;
                        return next;
                      });
                    }}
                  />
                  </div>
                </label>
              );
            })}
          </div>
          <p className={`text-xs ${variableOk ? "text-muted-foreground" : "text-destructive"}`}>
            {variableDiff === 0
              ? variableOk
                ? tt("loan_variable_ok")
                : tt("loan_variable_mismatch")
              : variableDiff > 0
                ? `${tt("loan_variable_missing")}: ${formatCents(variableDiff)}`
                : `${tt("loan_variable_over")}: ${formatCents(-variableDiff)}`}
          </p>
        </div>
      )}

      {amountCents > 0 && schedule.length > 0 && payoff && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
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
                {!isVariable && schedule[schedule.length - 1].amountCents !== schedule[0].amountCents && (
                  <>
                    {" "}
                    ({tt("loan_preview_last")}{" "}
                    <span className="font-medium text-foreground">
                      {formatCents(schedule[schedule.length - 1].amountCents)}
                    </span>
                    )
                  </>
                )}
                {isVariable && <> ({tt("loan_scheme_variable").toLowerCase()})</>}, {tt("loan_preview_starting")}{" "}
                {pLabel(startPeriod)}.
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
