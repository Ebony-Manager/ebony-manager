"use client";

import * as React from "react";
import { BadgeCheck, Undo2 } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currentPeriod, formatCents, periodOrdinal, type Period } from "@/lib/planilla/payroll-period";
import { monthShort, shortPeriodLabel } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getEmployeeAnnualDetailAction, updateEmployeeAction, upsertPayrollEntryAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

type DetailRow = Awaited<ReturnType<typeof getEmployeeAnnualDetailAction>>[number];
type Concept = "decimo" | "vacacion" | "prima";

const CONCEPTS: {
  key: Concept;
  title: keyof typeof strings.planilla;
  paid: (r: DetailRow) => number;
  accrued: (r: DetailRow) => number;
  field: "decimoPaidCents" | "vacationPaidCents" | "primaAntiguedadPaidCents";
}[] = [
  {
    key: "decimo",
    title: "concept_decimo",
    paid: (r) => r.entry?.decimoPaidCents ?? 0,
    accrued: (r) => r.decimoAccrualBenefitsCents ?? r.decimoAccrualCents,
    field: "decimoPaidCents",
  },
  {
    key: "vacacion",
    title: "br_vacacion",
    paid: (r) => r.entry?.vacationPaidCents ?? 0,
    accrued: (r) => r.vacationAccrualBenefitsCents ?? r.vacationAccrualCents,
    field: "vacationPaidCents",
  },
  {
    key: "prima",
    title: "br_prima_note",
    paid: (r) => r.entry?.primaAntiguedadPaidCents ?? 0,
    accrued: (r) => r.primaAntiguedadAccrualCents,
    field: "primaAntiguedadPaidCents",
  },
];

/** Próxima fecha fija de cuota de décimo (15 abr / 15 ago / 15 dic). */
function nextDecimoDate(now: Period): { month: number; year: number } {
  const dates = [4, 8, 12];
  for (const m of dates) {
    if (m > now.month || (m === now.month && now.half === 1)) return { month: m, year: now.year };
  }
  return { month: 4, year: now.year + 1 };
}

/**
 * Prestaciones del empleado: décimo, vacación proporcional y prima de
 * antigüedad. Cada una muestra lo ACUMULADO a hoy (siempre sobre lo realmente
 * pagado, no sobre el sueldo base) y deja marcarla como pagada en una
 * quincena: al pagarla, el acumulado vuelve a empezar. También se puede
 * apagar por completo para quien no las lleva.
 */
export function EmployeeBenefitsSection({
  employee,
  initialDetail,
}: {
  employee: PayrollEmployee;
  initialDetail?: { year: number; rows: DetailRow[] };
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const now = React.useMemo(() => currentPeriod(), []);

  const [rows, setRows] = React.useState<DetailRow[] | null>(initialDetail?.year === now.year ? initialDetail.rows : null);
  const [enabled, setEnabled] = React.useState(employee.benefitsEnabled);
  const [paying, setPaying] = React.useState<Concept | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    getEmployeeAnnualDetailAction(employee.id, now.year)
      .then(setRows)
      .catch((err) => {
        console.error("Planilla: no se pudieron cargar las prestaciones", err);
        toast.error(tt("load_failed"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tt` solo cambia con el idioma.
  }, [employee.id, now.year]);

  React.useEffect(() => {
    if (!rows) load();
  }, [rows, load]);

  const nowOrd = periodOrdinal(now.year, now.month, now.half);
  const current = rows?.find((r) => r.month === now.month && r.half === now.half) ?? null;

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    try {
      await updateEmployeeAction(employee.id, { benefitsEnabled: next });
      toast.success(next ? tt("benefits_turned_on") : tt("benefits_turned_off"));
      load();
    } catch (err) {
      console.error("Planilla: no se pudo cambiar 'lleva prestaciones'", err);
      toast.error(tt("migration_pending"));
      setEnabled(!next);
    }
  }

  async function undoPayment(c: (typeof CONCEPTS)[number], r: DetailRow) {
    if (!window.confirm(tt("benefits_undo_confirm"))) return;
    setBusy(true);
    try {
      await upsertPayrollEntryAction({
        employeeId: employee.id,
        periodYear: r.year,
        periodMonth: r.month,
        periodHalf: r.half,
        [c.field]: 0,
      });
      load();
    } catch (err) {
      console.error("Planilla: no se pudo deshacer el pago", err);
      toast.error(tt("load_failed"));
    } finally {
      setBusy(false);
    }
  }

  const payingConcept = CONCEPTS.find((c) => c.key === paying) ?? null;

  return (
    <section className="flex flex-col gap-3 rounded-none border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{tt("benefits_title")}</h2>
          <p className="text-xs text-muted-foreground">{tt("benefits_desc")}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={enabled} onChange={(e) => void toggleEnabled(e.target.checked)} />
          {tt("f_benefits_enabled")}
        </label>
      </div>

      {!enabled ? (
        <p className="py-2 text-sm text-muted-foreground">{tt("benefits_off")}</p>
      ) : rows === null ? (
        <p className="py-2 text-xs text-muted-foreground">{tt("loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CONCEPTS.map((c) => {
            const accrued = current ? c.accrued(current) : 0;
            // Último pago de este concepto en el año (hasta hoy).
            const lastPaid = [...rows]
              .filter((r) => periodOrdinal(r.year, r.month, r.half) <= nowOrd && c.paid(r) > 0)
              .pop();
            const nd = c.key === "decimo" ? nextDecimoDate(now) : null;
            return (
              <div key={c.key} className="flex flex-col gap-2 rounded-none border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">{tt(c.title)}</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCents(accrued)}</p>
                <p className="text-xs text-muted-foreground">
                  {tt("benefits_accrued")}
                  {nd && (
                    <>
                      {" "}
                      · {tt("benefits_next_pay")} 15 {monthShort(lang, nd.month)}
                    </>
                  )}
                </p>
                {lastPaid ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BadgeCheck className="size-3.5 shrink-0" />
                    {tt("benefits_last_paid")}: {shortPeriodLabel(lang, lastPaid)} · {formatCents(c.paid(lastPaid))}
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      title={tt("benefits_undo")}
                      aria-label={tt("benefits_undo")}
                      disabled={busy}
                      onClick={() => void undoPayment(c, lastPaid)}
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{tt("benefits_never_paid")}</p>
                )}
                <Button variant="outline" size="sm" className="mt-auto" onClick={() => setPaying(c.key)}>
                  {tt("benefits_mark_paid")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {payingConcept && rows && (
        <PayDialog
          employee={employee}
          concept={payingConcept}
          rows={rows}
          now={now}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function PayDialog({
  employee,
  concept,
  rows,
  now,
  onClose,
  onSaved,
}: {
  employee: PayrollEmployee;
  concept: (typeof CONCEPTS)[number];
  rows: DetailRow[];
  now: Period;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  // Quincenas del año hasta la actual (más 2 por si se adelanta un pago).
  const options = rows.filter((r) => periodOrdinal(r.year, r.month, r.half) <= periodOrdinal(now.year, now.month, now.half) + 2);
  const keyOf = (r: { year: number; month: number; half: 1 | 2 }) => `${r.year}-${r.month}-${r.half}`;
  const [periodKey, setPeriodKey] = React.useState(`${now.year}-${now.month}-${now.half}`);
  const selected = options.find((r) => keyOf(r) === periodKey) ?? options[options.length - 1];
  const [amount, setAmount] = React.useState((concept.accrued(selected) / 100).toFixed(2));
  const [touched, setTouched] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Mientras no se haya escrito un monto a mano, sigue al acumulado de la quincena elegida.
  /* eslint-disable react-hooks/set-state-in-effect -- deriva de la quincena elegida. */
  React.useEffect(() => {
    if (!touched) setAmount((concept.accrued(selected) / 100).toFixed(2));
  }, [selected, concept, touched]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit() {
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (!(cents > 0)) {
      setError(tt("loan_f_amount_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await upsertPayrollEntryAction({
        employeeId: employee.id,
        periodYear: selected.year,
        periodMonth: selected.month,
        periodHalf: selected.half,
        [concept.field]: cents,
      });
      toast.success(tt("benefits_paid_saved"));
      onSaved();
    } catch (err) {
      console.error("Planilla: no se pudo registrar el pago", err);
      setError(tt("load_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${tt("benefits_mark_paid")} · ${tt(concept.title)}`}
      description={tt("benefits_pay_desc")}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={tt("action_save")}
      error={error}
    >
      <Field label={tt("benefits_pay_period")}>
        <Select value={periodKey} onValueChange={setPeriodKey}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {options.map((r) => (
              <SelectItem key={keyOf(r)} value={keyOf(r)}>
                {shortPeriodLabel(lang, r)}
                {concept.paid(r) > 0 ? ` · ${tt("benefits_already_paid")}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={tt("loan_f_amount")}>
        <MoneyInput
          value={amount}
          onValueChange={(v) => {
            setTouched(true);
            setAmount(v);
          }}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {tt("benefits_accrued")}: {formatCents(concept.accrued(selected))}
        </p>
      </Field>
    </FormDialog>
  );
}
