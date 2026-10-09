"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, ListTree } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { periodOrdinal, currentPeriod, formatCents } from "@/lib/planilla/payroll-period";
import { monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getEmployeeAnnualDetailAction } from "./actions";
import { LedgerSection } from "./ledger-section";
import type { LedgerPeriodOption } from "./ledger-entry-dialog";

type DetailRow = Awaited<ReturnType<typeof getEmployeeAnnualDetailAction>>[number];

export function EmployeeDetailSheet({
  employee,
  year,
  open,
  onOpenChange,
}: {
  employee: PayrollEmployee | null;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const employeeId = employee?.id ?? null;
  const [rows, setRows] = React.useState<DetailRow[] | null>(null);
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);

  const loadRows = React.useCallback(() => {
    if (!employeeId || !open) return;
    getEmployeeAnnualDetailAction(employeeId, year).then(setRows);
  }, [employeeId, year, open]);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  /* eslint-disable react-hooks/set-state-in-effect -- limpia filas del empleado anterior al cambiar de target. */
  React.useEffect(() => {
    setRows(null);
  }, [employeeId, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const withActivity = (rows ?? []).filter(
    (r) => r.entry !== null || r.ledgerDebtCents > 0 || r.ledgerPaymentCents > 0
  );

  const periodOptions: LedgerPeriodOption[] = (rows ?? [])
    .filter((r) => r.entry !== null)
    .map((r) => ({ payrollEntryId: r.entry!.id, year: r.year, month: r.month, half: r.half }));

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const current = currentPeriod();
  const currentOrdinal = periodOrdinal(current.year, current.month, current.half);
  const hasBenefitsBase =
    !!employee &&
    employee.benefitsBaseSalaryCents != null &&
    employee.benefitsBaseSalaryCents !== employee.baseSalaryCents;

  const BREAKDOWN_ROWS: { key: string; labelKey: keyof typeof strings.planilla; sign: 1 | -1; pick: (r: DetailRow) => number }[] = [
    { key: "base", labelKey: "br_salario_base", sign: 1, pick: (r) => r.entry?.basePayCents ?? 0 },
    {
      key: "extras",
      labelKey: "br_extras",
      sign: 1,
      pick: (r) =>
        r.entry ? r.entry.extraHoursCents + r.entry.extraDaysCents + r.entry.viaticosCents + r.entry.bonusCents : 0,
    },
    { key: "dias_libres", labelKey: "br_dias_libres", sign: 1, pick: (r) => r.entry?.diasLibresCents ?? 0 },
    { key: "descuentos", labelKey: "br_descuentos", sign: -1, pick: (r) => r.entry?.otherDeductionCents ?? 0 },
    { key: "abono", labelKey: "br_abono", sign: -1, pick: (r) => r.ledgerPaymentCents },
  ];

  function renderAccrualRow(
    key: string,
    label: string,
    detail: DetailRow[],
    accrualPick: (r: DetailRow) => number,
    paidPick: ((r: DetailRow) => number) | null
  ) {
    const monthly = months.map((month) => {
      const rowsThisMonth = detail.filter((r) => r.month === month);
      const paidRow = paidPick ? rowsThisMonth.find((r) => paidPick(r) > 0) : undefined;
      const paid = paidRow ? accrualPick(paidRow) : 0;
      const monthHasStarted = periodOrdinal(year, month, 1) <= currentOrdinal;
      const peak = Math.max(...rowsThisMonth.map((r) => accrualPick(r)), 0);
      const accrual = paid > 0 || monthHasStarted ? peak : 0;
      return { accrual, paid };
    });
    const yearTotal = monthly.reduce((s, v) => s + v.paid, 0);
    const hasAnything = yearTotal > 0 || monthly.some((v) => v.accrual > 0);
    if (!hasAnything) return null;
    return (
      <tr key={key} className="border-b border-border bg-muted/10 text-xs">
        <td className="sticky left-0 bg-muted/10 py-1 pl-6 pr-3 text-muted-foreground">{label}</td>
        {monthly.map((v, i) => (
          <td
            key={i}
            className={`px-2 py-1 text-right tabular-nums ${
              v.paid > 0 ? "font-semibold text-foreground" : "italic text-muted-foreground/45"
            }`}
          >
            {v.paid > 0 ? formatCents(v.paid) : v.accrual > 0 ? formatCents(v.accrual) : "–"}
          </td>
        ))}
        <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">{formatCents(yearTotal)}</td>
      </tr>
    );
  }

  const benefitsLabel = (base: keyof typeof strings.planilla) =>
    hasBenefitsBase
      ? `${tt(base)} (${tt("accrual_on_benefits")} ${formatCents(employee!.benefitsBaseSalaryCents ?? 0)} — ${tt("accrual_benefits_suffix")})`
      : tt(base);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{employee?.name ?? ""}</SheetTitle>
          <SheetDescription>
            {tt("detalle_title")} — {year}
          </SheetDescription>
          {employee && (
            <Link
              href={`/planilla/${employee.id}?from=registro`}
              className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-3.5" />
              {tt("open_full_profile")}
            </Link>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {withActivity.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {tt("no_pagos_en")} {year}.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">{tt("col_quincena")}</th>
                  <th className="py-2 text-right font-medium">{tt("col_base")}</th>
                  <th className="py-2 text-right font-medium">{tt("col_extras")}</th>
                  <th className="py-2 text-right font-medium">{tt("col_descuentos")}</th>
                  <th className="py-2 text-right font-medium">{tt("col_prestamos")}</th>
                  <th className="py-2 text-right font-medium">{tt("col_total")}</th>
                  <th className="py-2 text-right font-medium">{tt("col_saldo")}</th>
                </tr>
              </thead>
              <tbody>
                {withActivity.map((row) => (
                  <tr key={`${row.month}-${row.half}`} className="border-b border-border last:border-0">
                    <td className="py-1.5 text-foreground">
                      {monthShort(lang, row.month)} · {row.half === 1 ? "1ra" : "2da"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.entry ? formatCents(row.entry.basePayCents) : "–"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.entry
                        ? formatCents(
                            row.entry.extraHoursCents +
                              row.entry.extraDaysCents +
                              row.entry.viaticosCents +
                              row.entry.bonusCents +
                              row.entry.diasLibresCents +
                              row.entry.decimoPaidCents +
                              row.entry.vacationPaidCents
                          )
                        : "–"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.entry ? formatCents(row.entry.otherDeductionCents + row.ledgerPaymentCents) : "–"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.ledgerDebtCents > 0 ? `+${formatCents(row.ledgerDebtCents)}` : "–"}
                    </td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-foreground">
                      {formatCents(row.totalCents)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatCents(row.runningLedgerBalanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {withActivity.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="py-2 text-foreground">
                      {tt("total_year")} {year}
                    </td>
                    <td colSpan={4} />
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {formatCents(withActivity.reduce((sum, r) => sum + r.totalCents, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {rows && (
            <div className="mt-4 rounded-none border border-border">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/40"
                onClick={() => setBreakdownOpen((v) => !v)}
              >
                <ListTree className="size-3.5 text-muted-foreground" />
                {tt("desglose_mensual_toggle")}
                <ChevronDown
                  className={`ml-auto size-3.5 text-muted-foreground transition-transform ${breakdownOpen ? "" : "-rotate-90"}`}
                />
              </button>
              {breakdownOpen && (
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full min-w-[820px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="sticky left-0 bg-muted/40 px-3 py-1.5 text-left font-medium">{tt("concept_col")}</th>
                        {months.map((m) => (
                          <th key={m} className="px-2 py-1.5 text-center font-medium">
                            {monthShort(lang, m)}
                          </th>
                        ))}
                        <th className="px-3 py-1.5 text-right font-medium">
                          {tt("total_year")} {year}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {BREAKDOWN_ROWS.map((b) => {
                        const monthlyRaw = months.map((month) =>
                          rows.filter((r) => r.month === month).reduce((sum, r) => sum + b.pick(r), 0)
                        );
                        const yearTotal = monthlyRaw.reduce((s, v) => s + v, 0);
                        if (yearTotal === 0) return null;
                        return (
                          <tr key={b.key} className="border-b border-border bg-muted/10 text-xs">
                            <td className="sticky left-0 bg-muted/10 py-1 pl-3 pr-3 text-muted-foreground">{tt(b.labelKey)}</td>
                            {monthlyRaw.map((v, i) => (
                              <td key={i} className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                                {v !== 0 ? formatCents(v * b.sign) : "–"}
                              </td>
                            ))}
                            <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">
                              {formatCents(yearTotal * b.sign)}
                            </td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const monthlyLoan = months.map((month) =>
                          rows.filter((r) => r.month === month).reduce((sum, r) => sum + r.ledgerDebtCents, 0)
                        );
                        const yearLoan = monthlyLoan.reduce((s, v) => s + v, 0);
                        if (yearLoan === 0) return null;
                        return (
                          <tr className="border-b border-border bg-muted/10 text-xs italic">
                            <td className="sticky left-0 bg-muted/10 py-1 pl-3 pr-3 text-muted-foreground">
                              {tt("br_prestamo_otorgado")}
                            </td>
                            {monthlyLoan.map((v, i) => (
                              <td key={i} className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                                {v !== 0 ? formatCents(v) : "–"}
                              </td>
                            ))}
                            <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">
                              {formatCents(yearLoan)}
                            </td>
                          </tr>
                        );
                      })()}
                      {renderAccrualRow(
                        "decimo",
                        benefitsLabel("concept_decimo"),
                        rows,
                        hasBenefitsBase ? (r) => r.decimoAccrualBenefitsCents ?? 0 : (r) => r.decimoAccrualCents,
                        (r) => r.entry?.decimoPaidCents ?? 0
                      )}
                      {hasBenefitsBase &&
                        renderAccrualRow(
                          "decimo-ref",
                          `${tt("concept_decimo")} (${tt("accrual_real_reference")} ${formatCents(employee!.baseSalaryCents)}) — ${tt("reference_suffix")}`,
                          rows,
                          (r) => r.decimoAccrualCents,
                          null
                        )}
                      {renderAccrualRow(
                        "vacacion",
                        hasBenefitsBase ? benefitsLabel("br_vacacion") : tt("br_vacacion"),
                        rows,
                        hasBenefitsBase ? (r) => r.vacationAccrualBenefitsCents ?? 0 : (r) => r.vacationAccrualCents,
                        (r) => r.entry?.vacationPaidCents ?? 0
                      )}
                      {hasBenefitsBase &&
                        renderAccrualRow(
                          "vacacion-ref",
                          `${tt("br_vacacion")} (${tt("accrual_real_reference")} ${formatCents(employee!.baseSalaryCents)}) — ${tt("reference_suffix")}`,
                          rows,
                          (r) => r.vacationAccrualCents,
                          null
                        )}
                      {renderAccrualRow(
                        "prima",
                        tt("br_prima_note"),
                        rows,
                        (r) => r.primaAntiguedadAccrualCents,
                        (r) => r.entry?.primaAntiguedadPaidCents ?? 0
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {employeeId && <LedgerSection employeeId={employeeId} periodOptions={periodOptions} onChanged={loadRows} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
