"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { LedgerCategory, LedgerDirection } from "@/types/planilla";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createLedgerEntryAction } from "./actions";
import { LEDGER_CATEGORY_LABEL_KEY, GENERIC_LEDGER_CATEGORIES } from "./ledger-labels";
import { FormDialog, Field } from "./form-dialog";

const NO_PERIOD = "__none__";

/** Una quincena real del empleado para atar (opcionalmente) un
 *  movimiento — un abono solo baja el total de ESA quincena si se ata
 *  a una. Se arma de lo que el detalle anual ya tiene cargado. */
export interface LedgerPeriodOption {
  payrollEntryId: string;
  year: number;
  month: number;
  half: 1 | 2;
}

export function LedgerEntryDialog({
  employeeId,
  periodOptions,
  open,
  onOpenChange,
  onSaved,
}: {
  employeeId: string;
  periodOptions: LedgerPeriodOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [category, setCategory] = React.useState<LedgerCategory>("herramienta");
  const [direction, setDirection] = React.useState<LedgerDirection>("debt");
  const [amount, setAmount] = React.useState("");
  const [entryDate, setEntryDate] = React.useState(today);
  const [payrollEntryId, setPayrollEntryId] = React.useState(NO_PERIOD);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setCategory("herramienta");
    setDirection("debt");
    setAmount("");
    setEntryDate(today);
    setPayrollEntryId(NO_PERIOD);
    setNotes("");
    setError(null);
  }, [open, today]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit() {
    const amountCents = Math.round(parseFloat(amount || "0") * 100);
    if (amountCents <= 0) {
      setError(tt("loan_f_amount_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createLedgerEntryAction({
        employeeId,
        category,
        direction,
        amountCents,
        entryDate,
        payrollEntryId: payrollEntryId === NO_PERIOD ? null : payrollEntryId,
        notes: notes.trim() || null,
      });
      toast.success(tt("action_add"));
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
      title={tt("mov_dlg_title")}
      description={tt("mov_dlg_desc")}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={tt("action_add")}
      error={error}
    >
      <Field label={tt("mov_f_category")}>
        <Select value={category} onValueChange={(v) => setCategory(v as LedgerCategory)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GENERIC_LEDGER_CATEGORIES.map((key) => (
              <SelectItem key={key} value={key}>
                {t(lang, strings.planilla[LEDGER_CATEGORY_LABEL_KEY[key] as keyof typeof strings.planilla])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={tt("mov_f_type")}>
        <Select value={direction} onValueChange={(v) => setDirection(v as LedgerDirection)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="debt">{tt("mov_type_debt")}</SelectItem>
            <SelectItem value="payment">{tt("mov_type_payment")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tt("mov_f_amount")}>
          <MoneyInput value={amount} onValueChange={setAmount} />
        </Field>
        <Field label={tt("mov_f_date")}>
          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </Field>
      </div>

      <Field label={tt("mov_f_apply_period")}>
        <Select value={payrollEntryId} onValueChange={setPayrollEntryId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PERIOD}>{tt("mov_period_none")}</SelectItem>
            {periodOptions.map((p) => (
              <SelectItem key={p.payrollEntryId} value={p.payrollEntryId}>
                {monthShort(lang, p.month)} {p.year} · {p.half === 1 ? tt("quincena_1") : tt("quincena_2")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{tt("mov_period_hint")}</p>
      </Field>

      <Field label={tt("mov_f_notes")}>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
