"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { LedgerCategory, PayrollEmployee, PayrollLedgerEntry } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { buildLoanStatement } from "@/lib/planilla/loan-statement";
import { currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getLedgerEntriesAction } from "./actions";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { AddChargeDialog } from "./add-charge-dialog";

type View = "quincena" | "month" | "concept";

/**
 * "Préstamos y descuentos" del perfil del empleado: todo lo que se le
 * otorgó y todo lo que se le ha descontado, con su fecha y el saldo corrido,
 * en tres lecturas — por quincena (cada movimiento), por mes y por concepto
 * (préstamo / adelanto / herramienta / daño / InDrive). "Agregar" abre la
 * misma ventana que en Pagos; editar o cancelar cuotas sigue en el detalle
 * del empleado (Pagos → Quincena).
 */
export function EmployeeLoansSection({
  employee,
  initialEntries,
}: {
  employee: PayrollEmployee;
  /** Movimientos ya cargados por el servidor al abrir la página. */
  initialEntries?: PayrollLedgerEntry[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const catLabel = (c: LedgerCategory) => tt(LEDGER_CATEGORY_LABEL_KEY[c] as keyof typeof strings.planilla);
  const quincenaLabel = (p: { year: number; month: number; half: 1 | 2 }) =>
    `${monthLabel(lang, p.month).slice(0, 3)} ${p.half}Q ${p.year}`;

  const [entries, setEntries] = React.useState<PayrollLedgerEntry[] | null>(initialEntries ?? null);
  const [failed, setFailed] = React.useState(false);
  const [view, setView] = React.useState<View>("quincena");
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

  const views: { key: View; label: string }[] = [
    { key: "quincena", label: tt("ls_view_quincena") },
    { key: "month", label: tt("ls_view_month") },
    { key: "concept", label: tt("ls_view_concept") },
  ];
  const th = "px-3 py-2 font-medium";
  const num = "px-3 py-1.5 text-right tabular-nums";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{tt("loans_title")}</h2>
        <div className="flex flex-wrap items-center gap-1">
          {statement && statement.movements.length > 0 && (
            <div className="flex items-center gap-1">
              {views.map((v) => (
                <Button
                  key={v.key}
                  size="sm"
                  variant={view === v.key ? "secondary" : "ghost"}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            {t(lang, strings.pagos.add)}
          </Button>
        </div>
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">{tt("load_failed")}</p>
      ) : !statement ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : statement.movements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tt("ls_empty")}</p>
      ) : (
        <>
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
            {view === "quincena" && (
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className={th}>{tt("ls_col_period")}</th>
                    <th className={th}>{tt("ls_col_concept")}</th>
                    <th className={th}>{tt("ls_col_movement")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_amount")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.movements.map((m) => (
                    <tr
                      key={m.id}
                      className={`border-b border-border last:border-0 ${m.occurred ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <td className="px-3 py-1.5">{quincenaLabel(m.period)}</td>
                      <td className="px-3 py-1.5">{catLabel(m.category)}</td>
                      <td className="px-3 py-1.5">{m.direction === "debt" ? tt("ls_type_debt") : tt("ls_type_payment")}</td>
                      <td className={num}>
                        {m.direction === "debt" ? "" : "−"}
                        {formatCents(m.amountCents)}
                      </td>
                      <td className={num}>{formatCents(m.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {view === "month" && (
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className={th}>{tt("ls_col_month")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_given")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_paid")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.monthly.map((r) => (
                    <tr key={`${r.year}-${r.month}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">
                        {monthLabel(lang, r.month)} {r.year}
                      </td>
                      <td className={num}>{r.debtCents ? formatCents(r.debtCents) : "–"}</td>
                      <td className={num}>{r.paymentCents ? formatCents(r.paymentCents) : "–"}</td>
                      <td className={num}>{formatCents(r.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {view === "concept" && (
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className={th}>{tt("ls_col_concept")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_given")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_paid")}</th>
                    <th className={`${th} text-right`}>{tt("ls_col_balance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.byCategory.map((r) => (
                    <tr key={r.category} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">{catLabel(r.category)}</td>
                      <td className={num}>{formatCents(r.debtCents)}</td>
                      <td className={num}>{formatCents(r.paymentCents)}</td>
                      <td className={num}>{formatCents(r.balanceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {view === "quincena" && statement.movements.some((m) => !m.occurred) && (
            <p className="text-xs text-muted-foreground">{tt("ls_future_hint")}</p>
          )}
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
