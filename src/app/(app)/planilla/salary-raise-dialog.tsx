"use client";

import * as React from "react";
import toast from "react-hot-toast";

import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentPeriod, nextPeriod, periodOrdinal, previousPeriod, type Period } from "@/lib/planilla/payroll-period";
import { periodLabel } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { registerSalaryChangeAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

function keyOf(p: Period): string {
  return `${p.year}-${p.month}-${p.half}`;
}

/** Rango de quincenas para elegir "desde cuándo": ~6 meses atrás y ~15
 *  adelante. Un aumento casi siempre arranca cerca de hoy. */
function periodRange(from?: Period): Period[] {
  let p: Period = currentPeriod();
  for (let i = 0; i < 12; i++) p = previousPeriod(p.year, p.month, p.half);
  // Un primer sueldo suele arrancar en el ingreso del empleado, que puede ser
  // mucho antes: el rango arranca ahí si hace falta.
  if (from && periodOrdinal(from.year, from.month, from.half) < periodOrdinal(p.year, p.month, p.half)) p = from;
  const out: Period[] = [p];
  const end = nextPeriodN(currentPeriod(), 42);
  while (periodOrdinal(p.year, p.month, p.half) < periodOrdinal(end.year, end.month, end.half)) {
    p = nextPeriod(p);
    out.push(p);
  }
  return out;
}

function nextPeriodN(p: Period, n: number): Period {
  let out = p;
  for (let i = 0; i < n; i++) out = nextPeriod(out);
  return out;
}

export function SalaryRaiseDialog({
  employeeId,
  defaultFrom,
  open,
  onOpenChange,
  onSaved,
}: {
  employeeId: string;
  /** Quincena sugerida para "desde cuándo" (ej. el ingreso, en un primer sueldo). */
  defaultFrom?: Period;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: { monthlySalaryCents: number; benefitsBaseSalaryCents: number | null }) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const periods = React.useMemo(() => periodRange(defaultFrom), [defaultFrom]);
  const pLabel = (p: Period) => periodLabel(lang, p, tt("quincena_1"), tt("quincena_2"));

  const [monthly, setMonthly] = React.useState("");
  const [benefits, setBenefits] = React.useState("");
  const [periodKey, setPeriodKey] = React.useState(() => keyOf(currentPeriod()));
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setMonthly("");
    setBenefits("");
    setPeriodKey(keyOf(defaultFrom ?? currentPeriod()));
    setNotes("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit() {
    const monthlyCents = Math.round(parseFloat(monthly || "0") * 100);
    if (monthlyCents <= 0) {
      setError(tt("raise_amount_required"));
      return;
    }
    const p = periods.find((x) => keyOf(x) === periodKey) ?? currentPeriod();
    setSubmitting(true);
    setError(null);
    try {
      const benefitsCents = benefits.trim() ? Math.round(parseFloat(benefits) * 100) : null;
      await registerSalaryChangeAction({
        employeeId,
        monthlySalaryCents: monthlyCents,
        benefitsBaseSalaryCents: benefitsCents,
        effectiveYear: p.year,
        effectiveMonth: p.month,
        effectiveHalf: p.half,
        notes: notes.trim() || null,
      });
      toast.success(tt("raise_saved"));
      onOpenChange(false);
      onSaved({ monthlySalaryCents: monthlyCents, benefitsBaseSalaryCents: benefitsCents });
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
      title={tt("raise_title")}
      description={tt("raise_desc")}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={tt("raise_submit")}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={tt("raise_f_monthly")}>
          <MoneyInput value={monthly} onValueChange={setMonthly} autoFocus />
        </Field>
        <Field label={tt("raise_f_benefits")}>
          <MoneyInput value={benefits} onValueChange={setBenefits} placeholder={tt("f_benefits_hint")} />
        </Field>
      </div>

      <Field label={tt("raise_f_from")}>
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {periods.map((p) => (
              <SelectItem key={keyOf(p)} value={keyOf(p)}>
                {pLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{tt("raise_from_hint")}</p>
      </Field>

      <Field label={tt("mov_f_notes")}>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tt("raise_notes_ph")} />
      </Field>
    </FormDialog>
  );
}
