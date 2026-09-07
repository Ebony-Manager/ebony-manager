"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentPeriod, nextPeriod, previousPeriod, type Period } from "@/lib/planilla/payroll-period";
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
function periodRange(): Period[] {
  let p: Period = currentPeriod();
  for (let i = 0; i < 12; i++) p = previousPeriod(p.year, p.month, p.half);
  const out: Period[] = [p];
  for (let i = 0; i < 42; i++) {
    p = nextPeriod(p);
    out.push(p);
  }
  return out;
}

export function SalaryRaiseDialog({
  employeeId,
  open,
  onOpenChange,
  onSaved,
}: {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();

  const periods = React.useMemo(() => periodRange(), []);
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
    setPeriodKey(keyOf(currentPeriod()));
    setNotes("");
    setError(null);
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
      await registerSalaryChangeAction({
        employeeId,
        monthlySalaryCents: monthlyCents,
        benefitsBaseSalaryCents: benefits.trim() ? Math.round(parseFloat(benefits) * 100) : null,
        effectiveYear: p.year,
        effectiveMonth: p.month,
        effectiveHalf: p.half,
        notes: notes.trim() || null,
      });
      toast.success(tt("raise_saved"));
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
      title={tt("raise_title")}
      description={tt("raise_desc")}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={tt("raise_submit")}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={tt("raise_f_monthly")}>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </Field>
        <Field label={tt("raise_f_benefits")}>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            placeholder={tt("f_benefits_hint")}
          />
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
