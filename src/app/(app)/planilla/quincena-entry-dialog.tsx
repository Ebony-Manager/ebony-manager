"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { PayrollEntry } from "@/types/planilla";
import type { RegistroRow } from "@/services/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { computePeriodTotalFromEntry } from "@/lib/planilla/payroll-accruals";
import { dailyRateCents, hourlyRateCents, quantityToCents } from "@/lib/planilla/payroll-rates";
import { formatCents, monthLabel, type Period } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { upsertPayrollEntryAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";

type Quantity = "extraHours" | "extraDays" | "horasDescontadas" | "diasDescontados";
type Money = "bonusCents" | "diasLibresCents" | "viaticosCents" | "decimoPaidCents" | "vacationPaidCents" | "primaAntiguedadPaidCents";


const toCentsStr = (c: number) => (c ? (c / 100).toFixed(2) : "");
const parseCents = (s: string) => {
  const v = Math.round(parseFloat(s || "0") * 100);
  return Number.isFinite(v) ? v : 0;
};
const parseQty = (s: string) => {
  const v = parseFloat(s || "0");
  return Number.isFinite(v) ? v : 0;
};

/**
 * Editar la quincena de una persona: extras (horas y días extra, bonos, días
 * libres, viáticos), asistencia (horas y días descontados — normalmente
 * llegan solos desde Asistencia) y prestaciones (décimo, vacación, prima).
 * Las cuotas de préstamos y descuentos se ven pero no se editan acá: viven
 * en Préstamos y descuentos. Abajo, el neto con los cambios, al instante.
 */
export function QuincenaEntryDialog({
  row,
  period,
  open,
  onOpenChange,
  onSaved,
  onOpenLoans,
}: {
  row: RegistroRow | null;
  period: Period;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Abre la pestaña Préstamos y descuentos del empleado. */
  onOpenLoans: (employeeId: string) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [qty, setQty] = React.useState<Record<Quantity, string>>({ extraHours: "", extraDays: "", horasDescontadas: "", diasDescontados: "" });
  const [money, setMoney] = React.useState<Record<Money, string>>({
    bonusCents: "",
    diasLibresCents: "",
    viaticosCents: "",
    decimoPaidCents: "",
    vacationPaidCents: "",
    primaAntiguedadPaidCents: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- siembra el formulario al abrir. */
  React.useEffect(() => {
    if (!open || !row) return;
    const e = row.total.entry;
    const q = (v: number | undefined) => (v ? String(v) : "");
    setQty({
      extraHours: q(e?.extraHours),
      extraDays: q(e?.extraDays),
      horasDescontadas: q(e?.horasDescontadas),
      diasDescontados: q(e?.diasDescontados),
    });
    setMoney({
      bonusCents: toCentsStr(e?.bonusCents ?? 0),
      diasLibresCents: toCentsStr(e?.diasLibresCents ?? 0),
      viaticosCents: toCentsStr(e?.viaticosCents ?? 0),
      decimoPaidCents: toCentsStr(e?.decimoPaidCents ?? 0),
      vacationPaidCents: toCentsStr(e?.vacationPaidCents ?? 0),
      primaAntiguedadPaidCents: toCentsStr(e?.primaAntiguedadPaidCents ?? 0),
    });
    setError(null);
  }, [open, row]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!row) return null;

  // Montos de las cantidades con la tarifa del sueldo vigente de esa quincena
  // (la misma que usa el servidor). Una cantidad que no se tocó conserva el
  // monto guardado tal cual (las quincenas viejas pueden traer montos del
  // Excel que no salen exactos de la fórmula).
  const e = row.total.entry;
  const hourly = hourlyRateCents({ baseSalaryCents: row.monthlySalaryCents });
  const daily = dailyRateCents({ baseSalaryCents: row.monthlySalaryCents });
  const QTY_CENTS = {
    extraHours: "extraHoursCents",
    extraDays: "extraDaysCents",
    horasDescontadas: "horasDescontadasCents",
    diasDescontados: "diasDescontadosCents",
  } as const;
  const qtyChanged = (k: Quantity) => Math.abs(parseQty(qty[k]) - (e?.[k] ?? 0)) > 1e-9;
  const centsOf = (k: Quantity) =>
    !qtyChanged(k) && e
      ? e[QTY_CENTS[k]]
      : quantityToCents(parseQty(qty[k]), k === "extraHours" || k === "horasDescontadas" ? hourly : daily);

  // Solo lo que cambió: lo demás queda como está guardado.
  const patch: Partial<PayrollEntry> = {};
  for (const k of ["extraHours", "extraDays", "horasDescontadas", "diasDescontados"] as Quantity[]) {
    if (qtyChanged(k)) Object.assign(patch, { [k]: parseQty(qty[k]), [QTY_CENTS[k]]: centsOf(k) });
  }
  for (const k of Object.keys(money) as Money[]) {
    const cents = parseCents(money[k]);
    if (cents !== (e?.[k] ?? 0)) patch[k] = cents;
  }
  const preview = e
    ? computePeriodTotalFromEntry({ ...e, ...patch }, { debt: row.total.ledgerDebtCents, payment: row.total.ledgerPaymentCents })
    : null;

  async function submit() {
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await upsertPayrollEntryAction({
        employeeId: row!.employee.id,
        periodYear: period.year,
        periodMonth: period.month,
        periodHalf: period.half,
        ...patch,
      });
      toast.success(tt("qe_saved"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Planilla: no se pudo guardar la quincena", err);
      setError(tt("save_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  const quantityField = (k: Quantity, label: string, unit: string) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={qty[k]}
          placeholder="0"
          onChange={(e) => setQty((p) => ({ ...p, [k]: e.target.value }))}
          className="w-24 text-right"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatCents(centsOf(k))}</span>
      </div>
    </Field>
  );
  const moneyField = (k: Money, label: string) => (
    <Field label={label}>
      <MoneyInput value={money[k]} onValueChange={(v) => setMoney((p) => ({ ...p, [k]: v }))} />
    </Field>
  );
  const section = "flex flex-col gap-3 rounded-lg border border-border p-3";
  const sectionTitle = "text-xs font-semibold text-foreground";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row.employee.name}
      description={`${monthLabel(lang, period.month)} · ${period.half === 1 ? tt("quincena_1") : tt("quincena_2")} ${period.year}`}
      onSubmit={submit}
      submitting={submitting}
      submitLabel={tt("qe_save")}
      error={error}
      wide
    >
      <div className={section}>
        <p className={sectionTitle}>{tt("qe_extras")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quantityField("extraHours", tt("col_extra_hours"), "h")}
          {quantityField("extraDays", tt("col_extra_days"), "d")}
          {moneyField("bonusCents", tt("col_bonos"))}
          {moneyField("diasLibresCents", tt("col_dias_libres"))}
          {moneyField("viaticosCents", tt("li_viaticos"))}
        </div>
      </div>

      <div className={section}>
        <p className={sectionTitle}>{tt("qe_asistencia")}</p>
        <p className="-mt-2 text-[11px] text-muted-foreground">{tt("qe_asistencia_hint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quantityField("horasDescontadas", tt("col_horas_desc"), "h")}
          {quantityField("diasDescontados", tt("col_dias_desc"), "d")}
        </div>
      </div>

      <div className={section}>
        <div className="flex items-center justify-between gap-2">
          <p className={sectionTitle}>{tt("col_prestamos_desc")}</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              onOpenChange(false);
              onOpenLoans(row.employee.id);
            }}
          >
            {tt("qe_loans_open")}
          </Button>
        </div>
        {row.deductions.length === 0 && !e?.otherDeductionCents ? (
          <p className="text-xs text-muted-foreground">{tt("qe_loans_none")}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {row.deductions.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-foreground">
                  {tt(LEDGER_CATEGORY_LABEL_KEY[d.category] as keyof typeof strings.planilla)}
                  {d.notes && <span className="text-muted-foreground"> · {d.notes}</span>}
                </span>
                <span className="tabular-nums text-foreground">−{formatCents(d.amountCents)}</span>
              </li>
            ))}
            {/* Otros descuentos de la quincena (no es asistencia): va con préstamos y descuentos. */}
            {!!e?.otherDeductionCents && (
              <li className="flex items-center justify-between gap-2">
                <span className="text-foreground">{tt("li_otros_descuentos")}</span>
                <span className="tabular-nums text-foreground">−{formatCents(e.otherDeductionCents)}</span>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className={section}>
        <p className={sectionTitle}>{tt("col_prestaciones_simple")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {moneyField("decimoPaidCents", tt("col_decimo"))}
          {moneyField("vacationPaidCents", tt("col_vacacion"))}
          {moneyField("primaAntiguedadPaidCents", tt("col_prima"))}
        </div>
      </div>

      {preview && (
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{tt("qe_net")}</span>
          <span className="font-semibold tabular-nums text-foreground">{formatCents(preview.totalCents)}</span>
        </div>
      )}
    </FormDialog>
  );
}
