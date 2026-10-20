"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, ListTree } from "lucide-react";

import type { PayrollEmployee, PayrollLedgerEntry, PayrollLoanWithSchedule } from "@/types/planilla";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { periodOrdinal, currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { monthShort } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEmployeeAnnualDetailAction, getLedgerEntriesAction, getLoansAction } from "./actions";
import { LoansPanel } from "./loans-panel";
import { OtherMovementsPanel } from "./other-movements-panel";
import { IndrivePanel } from "./indrive-panel";
import type { LedgerPeriodOption } from "./ledger-entry-dialog";

type DetailRow = Awaited<ReturnType<typeof getEmployeeAnnualDetailAction>>[number];

/** Cuántas filas se ven en el resumen antes de pedir "Ver todo". */
const SUMMARY_COMPACT_ROWS = 6;

type SummaryView = "quincena" | "month";

interface SummaryLine {
  key: string;
  label: string;
  base: number;
  extras: number;
  deductions: number;
  loans: number;
  total: number;
}

export function EmployeeDetailSheet({
  employee,
  year,
  initialTab = "resumen",
  open,
  onOpenChange,
  onChanged,
}: {
  employee: PayrollEmployee | null;
  year: number;
  /** Pestaña con la que se abre (ej. "prestamos" desde la vista de préstamos). */
  initialTab?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Avisa que algo del ledger/préstamos cambió, para que Registro se vuelva a leer. */
  onChanged?: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const employeeId = employee?.id ?? null;
  const [rows, setRows] = React.useState<DetailRow[] | null>(null);
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);
  const [rowsFailed, setRowsFailed] = React.useState(false);
  const [tab, setTab] = React.useState("resumen");
  const [summaryView, setSummaryView] = React.useState<SummaryView>("quincena");
  const [showAll, setShowAll] = React.useState(false);
  const [loans, setLoans] = React.useState<PayrollLoanWithSchedule[] | null>(null);
  const [ledger, setLedger] = React.useState<PayrollLedgerEntry[] | null>(null);

  const loadRows = React.useCallback(() => {
    if (!employeeId || !open) return;
    getEmployeeAnnualDetailAction(employeeId, year)
      .then((r) => {
        setRows(r);
        setRowsFailed(false);
      })
      .catch((err) => {
        console.error("Planilla: no se pudo cargar el resumen del empleado", err);
        setRowsFailed(true);
      });
  }, [employeeId, year, open]);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  const loadFinancing = React.useCallback(() => {
    if (!employeeId || !open) return;
    getLoansAction(employeeId).then(setLoans);
    getLedgerEntriesAction(employeeId).then(setLedger);
  }, [employeeId, open]);

  React.useEffect(() => {
    loadFinancing();
  }, [loadFinancing]);

  /** Algo de préstamos / herramientas / InDrive cambió: se vuelve a leer lo de
   *  esta ventana y se avisa a Registro (sus totales dependen de esto). */
  const handleChanged = React.useCallback(() => {
    loadFinancing();
    loadRows();
    onChanged?.();
  }, [loadFinancing, loadRows, onChanged]);

  /* eslint-disable react-hooks/set-state-in-effect -- limpia filas del empleado anterior al cambiar de target. */
  React.useEffect(() => {
    setRows(null);
    setRowsFailed(false);
    setLoans(null);
    setLedger(null);
    setTab(initialTab);
    setShowAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la pestaña inicial solo importa al abrir.
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


  // Resumen compacto: una línea por quincena o por mes, solo con lo que importa.
  const quincenaLines: SummaryLine[] = withActivity.map((row) => ({
    key: `${row.month}-${row.half}`,
    label: `${monthShort(lang, row.month)} · ${row.half === 1 ? "1ra" : "2da"}`,
    base: row.entry?.basePayCents ?? 0,
    extras: row.entry
      ? row.entry.extraHoursCents +
        row.entry.extraDaysCents +
        row.entry.viaticosCents +
        row.entry.bonusCents +
        row.entry.diasLibresCents +
        row.entry.decimoPaidCents +
        row.entry.vacationPaidCents
      : 0,
    deductions: row.entry ? row.entry.otherDeductionCents + row.ledgerPaymentCents : 0,
    loans: row.ledgerDebtCents,
    total: row.totalCents,
  }));
  const monthLines: SummaryLine[] = months
    .map((month) => {
      const inMonth = withActivity.filter((r) => r.month === month);
      if (inMonth.length === 0) return null;
      const lines = quincenaLines.filter((l) => l.key.startsWith(`${month}-`));
      const sum = (pick: (l: SummaryLine) => number) => lines.reduce((acc, l) => acc + pick(l), 0);
      return {
        key: `m-${month}`,
        label: monthLabel(lang, month),
        base: sum((l) => l.base),
        extras: sum((l) => l.extras),
        deductions: sum((l) => l.deductions),
        loans: sum((l) => l.loans),
        total: sum((l) => l.total),
      } satisfies SummaryLine;
    })
    .filter((l): l is SummaryLine => l !== null);
  const allLines = summaryView === "month" ? monthLines : quincenaLines;
  // Lo más reciente primero y recortado: arriba lo que se está trabajando ahora.
  const orderedLines = [...allLines].reverse();
  const visibleLines = showAll ? orderedLines : orderedLines.slice(0, SUMMARY_COMPACT_ROWS);
  const hiddenCount = orderedLines.length - visibleLines.length;

  const benefitsLabel = (base: keyof typeof strings.planilla) =>
    hasBenefitsBase
      ? `${tt(base)} (${tt("accrual_on_benefits")} ${formatCents(employee!.benefitsBaseSalaryCents ?? 0)} — ${tt("accrual_benefits_suffix")})`
      : tt(base);

  const tabClass = "px-3 text-xs";

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
          <Tabs value={tab} onValueChange={setTab} className="gap-3">
            <TabsList className="h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="resumen" className={tabClass}>
                {tt("tab_resumen")}
              </TabsTrigger>
              <TabsTrigger value="prestamos" className={tabClass}>
                {tt("tab_prestamos")}
              </TabsTrigger>
              <TabsTrigger value="herramientas" className={tabClass}>
                {tt("tab_herramientas")}
              </TabsTrigger>
              <TabsTrigger value="indrive" className={tabClass}>
                {tt("tab_indrive")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-0">
              {rows === null && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {rowsFailed ? (
                    <>
                      <p>{tt("load_failed")}</p>
                      <Button variant="outline" size="sm" className="mt-2" onClick={loadRows}>
                        {tt("retry")}
                      </Button>
                    </>
                  ) : (
                    tt("loading")
                  )}
                </div>
              )}
              {withActivity.length === 0 && rows && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tt("no_pagos_en")} {year}.
                </p>
              )}
              {withActivity.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(["quincena", "month"] as const).map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant={summaryView === v ? "secondary" : "ghost"}
                          className="h-7 px-2.5 text-xs"
                          onClick={() => {
                            setSummaryView(v);
                            setShowAll(false);
                          }}
                        >
                          {tt(v === "quincena" ? "sum_view_quincena" : "sum_view_month")}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tt("total_year")} {year}:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatCents(withActivity.reduce((sum, r) => sum + r.totalCents, 0))}
                      </span>
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2 font-medium">
                            {summaryView === "month" ? tt("sum_month_col") : tt("col_quincena")}
                          </th>
                          <th className="py-2 text-right font-medium">{tt("col_base")}</th>
                          <th className="py-2 text-right font-medium">{tt("col_extras")}</th>
                          <th className="py-2 text-right font-medium">{tt("col_descuentos")}</th>
                          <th className="py-2 text-right font-medium">{tt("col_prestamos")}</th>
                          <th className="py-2 text-right font-medium">{tt("col_total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLines.map((l) => (
                          <tr key={l.key} className="border-b border-border last:border-0">
                            <td className="py-1.5 text-foreground">{l.label}</td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatCents(l.base)}</td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{l.extras ? formatCents(l.extras) : "–"}</td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">{l.deductions ? formatCents(l.deductions) : "–"}</td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                              {l.loans > 0 ? `+${formatCents(l.loans)}` : "–"}
                            </td>
                            <td className="py-1.5 text-right font-medium tabular-nums text-foreground">{formatCents(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {orderedLines.length > SUMMARY_COMPACT_ROWS && (
                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAll((v) => !v)}
                    >
                      <ChevronDown className={`size-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                      {showAll ? tt("sum_show_less") : `${tt("sum_show_all")} (+${hiddenCount})`}
                    </button>
                  )}
                </>
              )}

          {rows && (
            <div className="mt-4 rounded-lg border border-border">
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

            </TabsContent>

            <TabsContent value="prestamos" className="mt-0">
              {employeeId && (
                <LoansPanel
                  employeeId={employeeId}
                  categories={["prestamo", "adelanto"]}
                  loans={loans}
                  onChanged={handleChanged}
                />
              )}
            </TabsContent>

            <TabsContent value="herramientas" className="mt-0 flex flex-col gap-5">
              {employeeId && (
                <>
                  <LoansPanel
                    employeeId={employeeId}
                    categories={["herramienta", "dano"]}
                    loans={loans}
                    onChanged={handleChanged}
                  />
                  <div className="border-t border-border pt-3">
                    <OtherMovementsPanel
                      employeeId={employeeId}
                      entries={ledger}
                      periodOptions={periodOptions}
                      onChanged={handleChanged}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="indrive" className="mt-0">
              {employeeId && <IndrivePanel employeeId={employeeId} onChanged={handleChanged} />}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
