"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { PayrollEmployee, PayrollLedgerEntry, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { buildLoanStatement } from "@/lib/planilla/loan-statement";
import { currentPeriod, formatCents } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getLedgerEntriesAction } from "./actions";
import { AddChargeDialog } from "./add-charge-dialog";
import { LoansPanel } from "./loans-panel";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";

/**
 * "Préstamos y descuentos" del perfil del empleado: todo lo que se le
 * muestra las obligaciones con sus cuotas. El estado de cuenta queda plegado
 * al final para consultar el historial completo de movimientos.
 */
export function EmployeeLoansSection({
  employee,
  initialEntries,
  loans,
}: {
  employee: PayrollEmployee;
  /** Movimientos ya cargados por el servidor al abrir la página. */
  initialEntries?: PayrollLedgerEntry[];
  loans: PayrollLoanWithSchedule[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [entries, setEntries] = React.useState<PayrollLedgerEntry[] | null>(initialEntries ?? null);
  const [failed, setFailed] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  // Sube al agregar algo: vuelve a leer los movimientos.
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    if (initialEntries && reloads === 0) return;
    let cancelled = false;
    getLedgerEntriesAction(employee.id)
      .then((e) => {
        if (!cancelled) setEntries(e);
      })
      .catch((err) => {
        console.error("Planilla: no se pudo cargar el ledger", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id, initialEntries, reloads]);

  const statement = React.useMemo(() => (entries ? buildLoanStatement(entries, currentPeriod()) : null), [entries]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{tt("loans_title")}</h2>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            {t(lang, strings.pagos.add)}
          </Button>
        </div>
      </div>

      {loans.length > 0 && <LoansPanel employeeId={employee.id} categories={["prestamo", "adelanto", "herramienta", "dano", "indrive", "otro", "tercero"]} loans={loans} onChanged={() => setReloads((n) => n + 1)} />}

      {failed ? (
        <p className="text-sm text-muted-foreground">{tt("load_failed")}</p>
      ) : !statement ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : statement.movements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tt("ls_empty")}</p>
      ) : (
        <>
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">{tt("ls_ledger_detail")} · {formatCents(statement.totals.balanceTodayCents)}</summary>
          <div className="flex flex-col gap-3 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: tt("ls_total_given"), value: statement.totals.debtCents },
              { label: tt("ls_total_paid"), value: statement.totals.paymentCents },
              { label: tt("ls_balance_today"), value: statement.totals.balanceTodayCents },
              { label: tt("ls_balance_end"), value: statement.totals.balanceEndCents },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatCents(k.value)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">{tt("ls_col_period")}</th>
                    <th className="px-3 py-2 text-left font-medium">{tt("ls_col_concept")}</th>
                    <th className="px-3 py-2 text-left font-medium">{tt("ls_col_movement")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tt("ls_col_amount")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tt("ls_col_balance")}</th>
                  </tr>
                </thead>
                <tbody>
            {statement.movements.map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b border-border last:border-0 ${m.occurred ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <td className="px-3 py-1.5">{`${new Date(m.period.year, m.period.month - 1).toLocaleString(lang === "en" ? "en-US" : "es", { month: "short" })} ${m.period.half}Q ${m.period.year}`}</td>
                      <td className="px-3 py-1.5">{tt(LEDGER_CATEGORY_LABEL_KEY[m.category] as keyof typeof strings.planilla)}</td>
                      <td className="px-3 py-1.5">{m.direction === "debt" ? tt("ls_type_debt") : tt("ls_type_payment")}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {m.direction === "debt" ? "" : "−"}
                        {formatCents(m.amountCents)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCents(m.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>

          {statement.movements.some((m) => !m.occurred) && (
            <p className="text-xs text-muted-foreground">{tt("ls_future_hint")}</p>
          )}
          </div>
          </details>
        </>
      )}
      <AddChargeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        person={{ kind: "employee", id: employee.id, name: employee.name }}
        onSaved={() => setReloads((n) => n + 1)}
      />
    </section>
  );
}
