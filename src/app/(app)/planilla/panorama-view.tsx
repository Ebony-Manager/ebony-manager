"use client";

import * as React from "react";
import Link from "next/link";

import type { PayrollEmployeeAnnualSummary, UpcomingObligations } from "@/types/planilla";
import { currentPeriod, formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getAnnualSummaryAction, getUpcomingObligationsAction, getLedgerBalanceAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";

/**
 * "Panorama" (Taller · Tanda 3/6) — vista de solo lectura en lenguaje
 * simple, sin jerga contable ni tablas, para alguien sin experiencia
 * financiera (más adelante el jefe de taller). Distinta de "Dashboard"
 * (ese sigue siendo el panel financiero, sin tocar).
 *
 * Reusa `getAnnualSummaryAction` / `getUpcomingObligationsAction` —
 * mismos datos que ya consume Dashboard, ninguna fórmula nueva. También
 * reusa `getLedgerBalanceAction` (ya existente, usado hoy por
 * `ledger-section.tsx`) para el saldo de préstamos POR EMPLEADO: ni
 * `conceptTotals.prestamosCents` (lo prestado en el año, no lo que debe
 * hoy) ni `getUpcomingObligationsAction` (solo un total de la empresa)
 * alcanzan para esa frase por persona.
 *
 * Cada tarjeta lleva al perfil del empleado (`/planilla/[id]`), donde
 * vive el Historial construido en la Tanda 1.
 */
export function PanoramaView() {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const year = React.useMemo(() => currentPeriod().year, []);
  const [rows, setRows] = React.useState<PayrollEmployeeAnnualSummary[] | null>(null);
  const [obligations, setObligations] = React.useState<UpcomingObligations | null>(null);
  const [balances, setBalances] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    getAnnualSummaryAction(year).then(setRows);
    getUpcomingObligationsAction().then(setObligations);
  }, [year]);

  React.useEffect(() => {
    if (!rows) return;
    let cancelled = false;
    const active = rows.filter((r) => r.employee.status === "ACTIVE");
    Promise.all(
      active.map((r) => getLedgerBalanceAction(r.employee.id).then((balance) => [r.employee.id, balance] as const))
    ).then((pairs) => {
      if (!cancelled) setBalances(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const active = (rows ?? []).filter((r) => r.employee.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{tt("pan_title")}</h2>
        <p className="text-sm text-muted-foreground">{tt("pan_subtitle")}</p>
      </div>

      {obligations && (
        <div className="flex flex-col gap-2 rounded-none border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">{tt("pan_overview_title")}</h3>
          <p className="text-sm text-muted-foreground">
            {tt("pan_overview_decimo_pre")}{" "}
            <span className="font-medium text-foreground">{formatCents(obligations.decimoPendingCents)}</span>{" "}
            {tt("pan_overview_decimo_post")} {formatDate(lang, obligations.decimoDueDate)}.
          </p>
          <p className="text-sm text-muted-foreground">
            {tt("pan_overview_vacacion_pre")}{" "}
            <span className="font-medium text-foreground">{formatCents(obligations.vacacionPendingCents)}</span>{" "}
            {tt("pan_overview_vacacion_post")}
          </p>
          <p className="text-sm text-muted-foreground">
            {obligations.employeesWithLoanBalance === 0 ? (
              tt("pan_overview_loans_none")
            ) : (
              <>
                {tt("pan_overview_loans_pre")} {obligations.employeesWithLoanBalance}{" "}
                {tt("pan_overview_loans_mid")}{" "}
                <span className="font-medium text-foreground">{formatCents(obligations.prestamosPendingCents)}</span>.
              </>
            )}
          </p>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-muted-foreground">{tt("loading")}</p>
      ) : active.length === 0 ? (
        <div className="rounded-none border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          {tt("pan_no_employees")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((row) => {
            const { employee } = row;
            const balance = balances[employee.id] ?? 0;
            const paymentStatusKey =
              row.monthsWithActivity === 0
                ? "pan_no_activity"
                : row.monthsPaid === row.monthsWithActivity
                  ? "pan_up_to_date"
                  : "pan_pending_payments";
            return (
              <Link
                key={employee.id}
                href={`/planilla/${employee.id}`}
                className="flex flex-col gap-3 rounded-none border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex items-center gap-3">
                  <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-foreground">{employee.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{employee.position || tt("no_position")}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
                  <p className="text-foreground">
                    {tt("pan_paid_this_year_pre")} <span className="font-semibold">{formatCents(row.paidCents)}</span>{" "}
                    {tt("pan_paid_this_year_post")}
                  </p>
                  <p className="text-muted-foreground">{tt(paymentStatusKey)}</p>
                  <p className={balance > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {balance > 0 ? (
                      <>
                        {tt("pan_owes_loans_pre")} {formatCents(balance)} {tt("pan_owes_loans_post")}
                      </>
                    ) : (
                      tt("pan_no_loans")
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
