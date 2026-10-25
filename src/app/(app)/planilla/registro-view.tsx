"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Download,
  FileText,
  Landmark,
  Wallet,
  Banknote,
  Award,
  UserX,
  Timer,
  Check,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";

import type { LedgerCategory, PayrollEmployee, PayrollEntry } from "@/types/planilla";
import type { RegistroRow } from "@/services/payroll";
import { computePeriodTotalFromEntry } from "@/lib/planilla/payroll-accruals";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentPeriod, nextPeriod, previousPeriod, formatCents, monthLabel, type Period } from "@/lib/planilla/payroll-period";
import { PAYROLL_FOOT_BG_CLASS, payrollCategoryInk, type PayrollCategoryKey } from "@/lib/planilla/payroll-colors";
import { computeRegistroSimpleTotals } from "@/lib/planilla/payroll-registro-totals";
import { matchesEmployeeQuery, numberEmployees } from "@/lib/planilla/employee-search";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getRegistroAction, upsertPayrollEntryAction, duplicatePreviousPeriodAction } from "./actions";
import { LEDGER_CATEGORY_LABEL_KEY } from "./ledger-labels";
import { RegistroKpiCard } from "./registro-kpi-card";
import { EmployeeSearchInput } from "./employee-search-input";
import { BankExportDialog } from "./bank-export-dialog";
import { QuincenaEntryDialog } from "./quincena-entry-dialog";
import { downloadQuincenaPdf } from "./quincena-pdf";
import { buildQuincenaReport } from "@/lib/planilla/quincena-report";
import { EmployeeAvatar } from "./employee-avatar";

type Row = RegistroRow;

/** Las columnas del recibo, de izquierda a derecha: Base + Extras −
 *  Asistencia − Préstamos y descuentos + Prestaciones = Neto. */
type AmountKey = "base" | "extras" | "asistencia" | "prestamos" | "prestaciones";
const AMOUNT_COLUMNS: { key: AmountKey; labelKey: keyof typeof strings.planilla; category: PayrollCategoryKey }[] = [
  { key: "base", labelKey: "col_salario_base", category: "salario" },
  { key: "extras", labelKey: "qe_extras", category: "bonos" },
  { key: "asistencia", labelKey: "qe_asistencia", category: "descuentos" },
  { key: "prestamos", labelKey: "col_prestamos_desc", category: "descuentoPrestamos" },
  { key: "prestaciones", labelKey: "col_prestaciones_simple", category: "decimo" },
];

/**
 * Personal → Pagos → Quincena: una fila por empleado activo, como un recibo
 * (Base + Extras − Asistencia − Préstamos y descuentos + Prestaciones =
 * Neto) y la casilla de Pagado. La tabla es para revisar: clic en una fila
 * abre la ventana para editar esa quincena (`QuincenaEntryDialog`). Las
 * horas y días descontados llegan desde Asistencia; las cuotas, desde
 * Préstamos y descuentos. Prestaciones (de temporada) solo aparece cuando
 * alguien tiene algo en la quincena. Al pasar el mouse por un monto se ve
 * su detalle.
 */
export function RegistroView({
  employees,
  onViewDetail,
  reloadSignal = 0,
}: {
  employees: PayrollEmployee[];
  /** Abre el detalle del empleado (opcional: en una pestaña, ej. "prestamos"). */
  onViewDetail: (employeeId: string, tab?: string) => void;
  /** Sube cuando algo cambió fuera de esta tabla (ej. un préstamo desde la ventana del empleado): se vuelve a leer la quincena. */
  reloadSignal?: number;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const deductionLabel = (c: LedgerCategory) => tt(LEDGER_CATEGORY_LABEL_KEY[c] as keyof typeof strings.planilla);

  const [period, setPeriod] = React.useState(() => currentPeriod());
  // `rows` recuerda A QUÉ quincena pertenecen los datos: mientras el fetch de
  // otra quincena no vuelve, no se pinta nada (ver `visibleRows`).
  const [rows, setRows] = React.useState<{ period: Period; data: Row[] } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [duplicating, setDuplicating] = React.useState(false);
  const [bankOpen, setBankOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // Buscador de empleado: la tabla se queda solo con quien coincida.
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(() => {
    const fetchedFor = period;
    startTransition(async () => {
      const data = await getRegistroAction(fetchedFor.year, fetchedFor.month, fetchedFor.half);
      setRows({ period: fetchedFor, data });
    });
  }, [period]);

  React.useEffect(() => {
    load();
  }, [load]);

  const firstSignal = React.useRef(true);
  React.useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  const samePeriod = (a: Period, b: Period) => a.year === b.year && a.month === b.month && a.half === b.half;
  const visibleRows = rows && samePeriod(rows.period, period) ? rows.data : null;
  // Período atado a los datos en pantalla: los guardados lo usan en vez del
  // `period` del closure, así nunca se le atribuye un valor a otra quincena.
  const dataPeriod = rows?.period ?? period;
  const fullRows = visibleRows ?? [];
  // El número de cada empleado se calcula sobre la lista COMPLETA; el filtro
  // Todos / Taller / Administrativo (que llega en `employees`) y la búsqueda
  // solo esconden filas, no renumeran.
  const employeeNumber = numberEmployees(fullRows.map((r) => r.employee.id));
  const allowedIds = new Set(employees.map((e) => e.id));
  const allRows = fullRows.filter((r) => allowedIds.has(r.employee.id));
  const shownRows = allRows.filter((r) => matchesEmployeeQuery(r.employee.name, query));
  const searching = query.trim() !== "";
  const shownTotalCents = shownRows.reduce((sum, r) => sum + r.total.totalCents, 0);
  const editing = fullRows.find((r) => r.employee.id === editingId) ?? null;

  function shiftPeriod(direction: -1 | 1) {
    setPeriod((p) => (direction === 1 ? nextPeriod(p) : previousPeriod(p.year, p.month, p.half)));
  }

  /** Marca / desmarca Pagado al instante y lo guarda en segundo plano. */
  async function togglePaid(employeeId: string, p: Period, paid: boolean) {
    const current = rows?.data.find((r) => r.employee.id === employeeId);
    if (current?.total.entry) {
      const entry: PayrollEntry = { ...current.total.entry, paid, paidAt: paid ? new Date().toISOString() : null };
      const total = computePeriodTotalFromEntry(entry, {
        debt: current.total.ledgerDebtCents,
        payment: current.total.ledgerPaymentCents,
      });
      setRows((prev) =>
        prev ? { ...prev, data: prev.data.map((r) => (r.employee.id === employeeId ? { ...r, total } : r)) } : prev
      );
    }
    try {
      await upsertPayrollEntryAction({ employeeId, periodYear: p.year, periodMonth: p.month, periodHalf: p.half, paid });
      if (!current?.total.entry) load();
    } catch (err) {
      console.error("Planilla: no se pudo guardar el cambio", err);
      toast.error(tt("save_failed"));
      load();
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const { copied } = await duplicatePreviousPeriodAction(period.year, period.month, period.half);
      toast.success(`${tt("duplicate_prev")} · ${copied}`);
      load();
    } finally {
      setDuplicating(false);
    }
  }

  /** PDF del resumen de la quincena que se está viendo (todos los empleados
   *  del período, no solo los de la búsqueda). */
  async function exportPdf() {
    if (!visibleRows) return;
    const p = dataPeriod;
    const quincena = `${p.half === 1 ? tt("quincena_1") : tt("quincena_2")} · ${monthLabel(lang, p.month)} ${p.year}`;
    const report = buildQuincenaReport(
      visibleRows.map(({ employee, total }) => ({
        employee,
        entry: total.entry,
        loanPaymentCents: total.ledgerPaymentCents,
        netCents: total.totalCents,
      }))
    );
    try {
      await downloadQuincenaPdf(
        report,
        {
          company: tt("pdf_company"),
          title: `${tt("pdf_title")} — ${quincena}`,
          generated: `${tt("pdf_generated")} ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { day: "numeric", month: "long", year: "numeric" })}`,
          columns: {
            n: "#",
            employee: tt("col_empleado"),
            base: tt("col_salario_base"),
            bonus: tt("qe_extras"),
            deductions: tt("qe_asistencia"),
            benefits: tt("col_prestaciones_simple"),
            loan: tt("col_prestamos_desc"),
            net: tt("pdf_col_net"),
            paid: tt("col_pagado"),
          },
          total: tt("col_total"),
          yes: tt("pdf_yes"),
          page: tt("pdf_page"),
        },
        `Planilla-${p.year}-${String(p.month).padStart(2, "0")}-${p.half}Q.pdf`
      );
    } catch (err) {
      console.error("Planilla: no se pudo generar el PDF", err);
      toast.error(tt("load_failed"));
    }
  }

  const quincenaLabel = (half: 1 | 2) => (half === 1 ? tt("quincena_1") : tt("quincena_2"));

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {tt("empty_registro")}
      </div>
    );
  }

  /** Montos del recibo de una fila (con signo) y el detalle de cada uno, para el mouse. */
  function amountsOf(r: Row): Record<AmountKey, { cents: number; detail: string }> {
    const e = r.total.entry;
    const s = computeRegistroSimpleTotals(e);
    const line = (label: string, cents: number, qty?: { n: number; unit: string }) =>
      cents ? `${label}${qty && qty.n ? ` (${qty.n} ${qty.unit})` : ""} · ${formatCents(cents)}` : "";
    const join = (...parts: string[]) => parts.filter(Boolean).join("\n");
    return {
      base: { cents: s.baseCents, detail: tt("base_readonly_hint") },
      extras: {
        cents: s.bonificacionesCents,
        detail: join(
          line(tt("col_extra_hours"), e?.extraHoursCents ?? 0, { n: e?.extraHours ?? 0, unit: "h" }),
          line(tt("col_extra_days"), e?.extraDaysCents ?? 0, { n: e?.extraDays ?? 0, unit: "d" }),
          line(tt("col_bonos"), e?.bonusCents ?? 0),
          line(tt("col_dias_libres"), e?.diasLibresCents ?? 0),
          line(tt("li_viaticos"), e?.viaticosCents ?? 0)
        ),
      },
      asistencia: {
        cents: -s.descuentosCents,
        detail: join(
          line(tt("col_horas_desc"), e?.horasDescontadasCents ?? 0, { n: e?.horasDescontadas ?? 0, unit: "h" }),
          line(tt("col_dias_desc"), e?.diasDescontadosCents ?? 0, { n: e?.diasDescontados ?? 0, unit: "d" })
        ),
      },
      prestamos: {
        cents: -(r.total.ledgerPaymentCents + s.otrosDescuentosCents),
        detail: join(
          ...r.deductions.map((d) => `${deductionLabel(d.category)}${d.notes ? ` (${d.notes})` : ""} · ${formatCents(d.amountCents)}`),
          line(tt("li_otros_descuentos"), s.otrosDescuentosCents)
        ),
      },
      prestaciones: {
        cents: s.prestacionesCents,
        detail: join(
          line(tt("col_decimo"), e?.decimoPaidCents ?? 0),
          line(tt("col_vacacion"), e?.vacationPaidCents ?? 0),
          line(tt("col_prima"), e?.primaAntiguedadPaidCents ?? 0)
        ),
      },
    };
  }

  // Prestaciones es de temporada: la columna solo aparece si alguien tiene algo.
  const showPrestaciones = allRows.some((r) => computeRegistroSimpleTotals(r.total.entry).prestacionesCents !== 0);
  const columns = AMOUNT_COLUMNS.filter((c) => c.key !== "prestaciones" || showPrestaciones);

  // Fila de KPIs — derivada de las mismas `rows` que pinta la tabla.
  const totalCents = allRows.reduce((sum, r) => sum + r.total.totalCents, 0);
  const loansCents = allRows.reduce((sum, r) => sum + r.total.ledgerPaymentCents + (r.total.entry?.otherDeductionCents ?? 0), 0);
  const decimoCents = allRows.reduce((sum, r) => sum + (r.total.entry?.decimoPaidCents ?? 0), 0);
  const pct = (part: number) => (totalCents > 0 ? `${((part / totalCents) * 100).toFixed(1)}% ${tt("kpi_pct_of_total")}` : "—");
  const asistenciaCents = allRows.reduce((sum, r) => sum + computeRegistroSimpleTotals(r.total.entry).descuentosCents, 0);
  const lateHours = allRows.reduce((sum, r) => sum + (r.total.entry?.horasDescontadas ?? 0), 0);
  const absentDays = allRows.reduce((sum, r) => sum + (r.total.entry?.diasDescontados ?? 0), 0);
  const overtimeCents = allRows.reduce((sum, r) => sum + (r.total.entry?.extraHoursCents ?? 0), 0);
  const overtimeHours = allRows.reduce((sum, r) => sum + (r.total.entry?.extraHours ?? 0), 0);
  const hoursLabel = (h: number) => `${Number(h.toFixed(2))} h`;
  const asistenciaLabel = `${hoursLabel(lateHours)} ${tt("kpi_late")} · ${Number(absentDays.toFixed(2))} ${tt("kpi_absent_days")}`;
  const thisYear = currentPeriod().year;
  const yearOptions = Array.from(new Set([...Array.from({ length: 5 }, (_, i) => thisYear - 3 + i), period.year])).sort(
    (a, b) => a - b
  );
  const th = "whitespace-nowrap px-3 py-[11px] text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-5">
        <RegistroKpiCard icon={Wallet} label={tt("kpi_total_due")} value={formatCents(totalCents)} sublabel={`${allRows.length} ${tt("kpi_employees_count")}`} />
        <RegistroKpiCard icon={Banknote} label={tt("kpi_loan_installments")} value={formatCents(loansCents)} sublabel={pct(loansCents)} />
        <RegistroKpiCard icon={Award} label={tt("kpi_decimo")} value={formatCents(decimoCents)} sublabel={pct(decimoCents)} />
        <RegistroKpiCard icon={UserX} label={tt("kpi_asistencia")} value={formatCents(asistenciaCents)} sublabel={asistenciaLabel} />
        <RegistroKpiCard icon={Timer} label={tt("kpi_overtime")} value={formatCents(overtimeCents)} sublabel={hoursLabel(overtimeHours)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border px-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          {/* Ir directo a una quincena: año + mes/quincena. */}
          <Select value={String(period.year)} onValueChange={(v) => setPeriod((p) => ({ ...p, year: Number(v) }))}>
            <SelectTrigger aria-label={tt("period_year_label")} className="h-7 w-[78px] border-0 bg-transparent px-2 text-sm font-medium shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={`${period.month}-${period.half}`}
            onValueChange={(v) => {
              const [m, h] = v.split("-").map(Number);
              setPeriod((p) => ({ ...p, month: m, half: h as 1 | 2 }));
            }}
          >
            <SelectTrigger aria-label={tt("period_pick_label")} className="h-7 w-[200px] border-0 bg-transparent px-2 text-sm font-medium shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {Array.from({ length: 24 }, (_, i) => {
                const m = Math.floor(i / 2) + 1;
                const h = ((i % 2) + 1) as 1 | 2;
                return (
                  <SelectItem key={i} value={`${m}-${h}`}>
                    {monthLabel(lang, m)} · {quincenaLabel(h)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftPeriod(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="ml-auto" disabled={visibleRows === null}>
              <Download className="size-3.5" />
              {tt("export_menu")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setBankOpen(true)}>
              <Landmark className="size-3.5" />
              {tt("export_bank")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={exportPdf}>
              <FileText className="size-3.5" />
              {tt("export_pdf")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Acciones poco frecuentes, apartadas a un lado para que no estorben. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={tt("more_actions")} title={tt("more_actions")}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={duplicating} onSelect={() => void handleDuplicate()}>
              <Copy className="size-3.5" />
              {tt("duplicate_prev")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Buscador de empleado: solo, en su propia fila, sobre la tabla. */}
      <EmployeeSearchInput value={query} onChange={setQuery} className="w-full max-w-md" />

      <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-900/8 bg-muted/40">
              <th className={`${th} sticky left-0 z-20 bg-muted text-left`}>{tt("col_empleado")}</th>
              {columns.map((c) => (
                <th key={c.key} className={`${th} text-right`} style={{ color: payrollCategoryInk(c.category) }}>
                  {tt(c.labelKey)}
                </th>
              ))}
              <th className={`${th} text-right`}>{tt("qe_net")}</th>
              <th className={`${th} text-center`}>{tt("col_pagado")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {shownRows.map((r) => {
              const { employee, total } = r;
              const e = total.entry;
              const amounts = amountsOf(r);
              return (
                <tr
                  key={`${employee.id}-${dataPeriod.year}-${dataPeriod.month}-${dataPeriod.half}`}
                  className="group/row cursor-pointer border-b border-ink-900/6 transition-colors last:border-0 hover:bg-muted/40"
                  onClick={() => setEditingId(employee.id)}
                  title={tt("qe_row_hint")}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-card py-[11px] pl-4 pr-3 font-semibold text-ink-900 group-hover/row:bg-muted">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 shrink-0 text-right text-[11px] font-normal tabular-nums text-muted-foreground" title={tt("emp_number_title")}>
                        {employeeNumber.get(employee.id)}
                      </span>
                      <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} />
                      <span className="text-[13px]">{employee.name}</span>
                    </div>
                  </td>
                  {columns.map((c) => {
                    const { cents, detail } = amounts[c.key];
                    const isLoans = c.key === "prestamos";
                    return (
                      <td
                        key={c.key}
                        className="px-3 py-[11px] text-right text-[12.5px] tabular-nums"
                        style={{ color: cents === 0 ? "var(--muted-foreground)" : payrollCategoryInk(c.category) }}
                        title={detail || undefined}
                        onClick={
                          isLoans && cents !== 0
                            ? (ev) => {
                                ev.stopPropagation();
                                onViewDetail(employee.id, "prestamos");
                              }
                            : undefined
                        }
                      >
                        <span className={isLoans && cents !== 0 ? "underline-offset-2 hover:underline" : undefined}>
                          {cents === 0 ? "–" : formatCents(cents)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-[11px] text-right text-[13.5px] font-bold tabular-nums text-ink-900">{formatCents(total.totalCents)}</td>
                  <td className="px-3 py-[11px]" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={e?.paid ?? false}
                        aria-label={tt("col_pagado")}
                        onClick={() => togglePaid(employee.id, dataPeriod, !(e?.paid ?? false))}
                        className={
                          e?.paid
                            ? "flex size-[18px] items-center justify-center rounded-[5px] bg-walnut"
                            : "size-[18px] rounded-[5px] border-[1.5px] border-ink-900/20"
                        }
                      >
                        {e?.paid && <Check className="size-3 text-white" strokeWidth={2.4} />}
                      </button>
                    </div>
                  </td>
                  <td className="pr-3 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100">
                    <Pencil className="size-3.5" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {visibleRows && shownRows.length > 0 && (
            <tfoot>
              <tr className={`border-t border-ink-900/8 ${PAYROLL_FOOT_BG_CLASS}`}>
                <td className="py-3 pr-3 pl-3 text-right text-[12.5px] font-semibold text-ink-900/60" colSpan={1 + columns.length}>
                  {searching ? `${tt("emp_search_total")} (${shownRows.length})` : tt("total_quincena")}
                </td>
                <td className="px-3 py-3 text-right text-[14px] font-bold tabular-nums text-ink-900">{formatCents(shownTotalCents)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {searching && visibleRows !== null && shownRows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {tt("emp_search_empty")}
        </p>
      )}

      <BankExportDialog open={bankOpen} onOpenChange={setBankOpen} period={dataPeriod} rows={fullRows} />
      <QuincenaEntryDialog
        row={editing}
        period={dataPeriod}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditingId(null)}
        onSaved={load}
        onOpenLoans={(id) => onViewDetail(id, "prestamos")}
      />

      {(pending || visibleRows === null) && <p className="text-xs text-muted-foreground">{tt("loading")}</p>}
    </div>
  );
}
