"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, Columns3, Wallet, Banknote, Award, TrendingDown, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";

import type { PayrollEmployee, PaymentMethod } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentPeriod, nextPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { PAYROLL_CATEGORY, type PayrollCategoryKey } from "@/lib/planilla/payroll-colors";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  getRegistroAction,
  upsertPayrollEntryAction,
  upsertPayrollQuantityFieldAction,
  duplicatePreviousPeriodAction,
} from "./actions";
import { COLUMN_DEFS, QUANTITY_FIELD_META, type ColumnKey, type FieldKey } from "./registro-columns";
import { PayrollKpiCard } from "./payroll-kpi-card";
import { EmployeeAvatar } from "./employee-avatar";

type Row = Awaited<ReturnType<typeof getRegistroAction>>[number];

/** Fecha real de pago de una quincena — el 15 para la 1a mitad, el
 *  último día del mes para la 2a — solo para el label del KPI "Próximo
 *  pago". */
function periodPayDate(p: { year: number; month: number; half: 1 | 2 }): Date {
  return p.half === 1 ? new Date(p.year, p.month - 1, 15) : new Date(p.year, p.month, 0);
}

function fieldHeaderStyle(category: PayrollCategoryKey | undefined, minWidth: number): React.CSSProperties {
  if (!category) return { minWidth };
  const color = PAYROLL_CATEGORY[category].color;
  return { minWidth, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`, color };
}

function fieldCellStyle(category: PayrollCategoryKey | undefined, minWidth: number): React.CSSProperties {
  if (!category) return { minWidth };
  const color = PAYROLL_CATEGORY[category].color;
  return { minWidth, backgroundColor: `color-mix(in oklch, ${color} 4%, transparent)` };
}

function fieldMinWidth(c: { key: FieldKey }): number {
  return QUANTITY_FIELD_META[c.key] ? 96 : 88;
}

/**
 * Registro de quincena — una fila por empleado activo, navegación de
 * quincena, inputs de cantidad con monto calculado automático, y
 * "duplicar quincena anterior". Portado de Atlas.
 *
 * `visibleColumns` es propiedad de planilla-client (persistido en
 * localStorage allá), no de este componente, para que la elección
 * sobreviva a cambiar de tab y volver — esta vista se desmonta cuando
 * su TabsContent queda inactivo y resetearía a los defaults al remontar.
 */
export function RegistroView({
  employees,
  visibleColumns,
  onVisibleColumnsChange,
  onViewDetail,
}: {
  employees: PayrollEmployee[];
  visibleColumns: Record<ColumnKey, boolean>;
  onVisibleColumnsChange: (columns: Record<ColumnKey, boolean>) => void;
  onViewDetail: (employeeId: string) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [period, setPeriod] = React.useState(() => currentPeriod());
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [duplicating, setDuplicating] = React.useState(false);

  const load = React.useCallback(() => {
    startTransition(async () => {
      const data = await getRegistroAction(period.year, period.month, period.half);
      setRows(data);
    });
  }, [period]);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month, period.half]);

  function shiftPeriod(direction: -1 | 1) {
    setPeriod((p) => {
      if (direction === 1) {
        if (p.half === 1) return { ...p, half: 2 };
        if (p.month === 12) return { year: p.year + 1, month: 1, half: 1 };
        return { year: p.year, month: p.month + 1, half: 1 };
      }
      if (p.half === 2) return { ...p, half: 1 };
      if (p.month === 1) return { year: p.year - 1, month: 12, half: 2 };
      return { year: p.year, month: p.month - 1, half: 2 };
    });
  }

  async function saveField(employeeId: string, field: FieldKey, value: string) {
    const cents = Math.round(parseFloat(value || "0") * 100);
    await upsertPayrollEntryAction({
      employeeId,
      periodYear: period.year,
      periodMonth: period.month,
      periodHalf: period.half,
      [field]: cents,
    });
    load();
  }

  /** Las cuatro columnas de cantidad (Horas/Días Extra, Horas/Días
   *  Descontados) — el servidor deriva el monto de la tarifa actual del
   *  empleado y guarda ambos (ver actions.ts). */
  async function saveQuantityField(
    employeeId: string,
    field: "extraHours" | "extraDays" | "horasDescontadas" | "diasDescontados",
    value: string
  ) {
    const quantity = parseFloat(value || "0");
    await upsertPayrollQuantityFieldAction({
      employeeId,
      periodYear: period.year,
      periodMonth: period.month,
      periodHalf: period.half,
      field,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    });
    load();
  }

  async function savePaymentMethod(employeeId: string, paymentMethod: PaymentMethod) {
    await upsertPayrollEntryAction({
      employeeId,
      periodYear: period.year,
      periodMonth: period.month,
      periodHalf: period.half,
      paymentMethod,
    });
    load();
  }

  async function togglePaid(employeeId: string, paid: boolean) {
    await upsertPayrollEntryAction({
      employeeId,
      periodYear: period.year,
      periodMonth: period.month,
      periodHalf: period.half,
      paid,
    });
    load();
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

  const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    efectivo: tt("pm_efectivo"),
    transferencia: tt("pm_transferencia"),
    yappy: tt("pm_yappy"),
    cheque: tt("pm_cheque"),
  };

  const quincenaLabel = (half: 1 | 2) => (half === 1 ? tt("quincena_1") : tt("quincena_2"));

  if (employees.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {tt("empty_registro")}
      </div>
    );
  }

  const fieldColumns = COLUMN_DEFS.filter(
    (c): c is { key: FieldKey; label: { es: string; en: string }; category?: PayrollCategoryKey } =>
      c.key !== "paymentMethod" && c.key !== "paid" && visibleColumns[c.key]
  );
  const visibleCount = 1 + COLUMN_DEFS.filter((c) => visibleColumns[c.key]).length;

  // Fila de KPIs — derivada de las mismas `rows` que pinta la tabla,
  // nunca un query aparte, para que nunca discrepen.
  const totalCents = (rows ?? []).reduce((sum, r) => sum + r.total.totalCents, 0);
  const cashCents = (rows ?? []).reduce(
    (sum, r) => sum + ((r.total.entry?.paymentMethod ?? "efectivo") === "efectivo" ? r.total.totalCents : 0),
    0
  );
  const decimoCents = (rows ?? []).reduce((sum, r) => sum + (r.total.entry?.decimoPaidCents ?? 0), 0);
  const descuentosCents = (rows ?? []).reduce(
    (sum, r) =>
      sum +
      (r.total.entry?.horasDescontadasCents ?? 0) +
      (r.total.entry?.diasDescontadosCents ?? 0) +
      (r.total.entry?.otherDeductionCents ?? 0),
    0
  );
  const pct = (part: number) =>
    totalCents > 0 ? `${((part / totalCents) * 100).toFixed(1)}% ${tt("kpi_pct_of_total")}` : "—";
  const upcoming = nextPeriod(period);
  const nextPayLabel = periodPayDate(upcoming).toLocaleDateString(lang === "en" ? "en-US" : "es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <PayrollKpiCard
          icon={Wallet}
          label={tt("kpi_total_due")}
          value={formatCents(totalCents)}
          sublabel={`${(rows ?? []).length} ${tt("kpi_employees_count")}`}
          color="var(--payroll-total-due)"
        />
        <PayrollKpiCard
          icon={Banknote}
          label={tt("kpi_cash")}
          value={formatCents(cashCents)}
          sublabel={pct(cashCents)}
          category="salario"
        />
        <PayrollKpiCard
          icon={Award}
          label={tt("kpi_decimo")}
          value={formatCents(decimoCents)}
          sublabel={pct(decimoCents)}
          category="decimo"
        />
        <PayrollKpiCard
          icon={TrendingDown}
          label={tt("kpi_deductions")}
          value={formatCents(descuentosCents)}
          sublabel={pct(descuentosCents)}
          category="descuentos"
        />
        <PayrollKpiCard
          icon={CalendarClock}
          label={tt("kpi_next_pay")}
          value={nextPayLabel}
          sublabel={quincenaLabel(upcoming.half)}
          color="var(--payroll-next-pay)"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border px-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium text-foreground">
            {monthLabel(lang, period.month)} {period.year} · {quincenaLabel(period.half)}
          </span>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftPeriod(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicating}>
          <Copy className="size-3.5" />
          {tt("duplicate_prev")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="ml-auto">
              <Columns3 className="size-3.5" />
              {tt("columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COLUMN_DEFS.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleColumns[col.key]}
                onCheckedChange={(checked) => onVisibleColumnsChange({ ...visibleColumns, [col.key]: checked })}
              >
                {t(lang, col.label)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              {/* Columna "Empleado" congelada al hacer scroll horizontal,
                  igual que en la Auditoría (sticky left-0 + fondo propio). */}
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">{tt("col_empleado")}</th>
              {fieldColumns.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 text-right font-medium"
                  style={fieldHeaderStyle(c.category, fieldMinWidth(c))}
                >
                  {t(lang, c.label)}
                </th>
              ))}
              {visibleColumns.paymentMethod && <th className="px-3 py-2 text-left font-medium">{tt("col_metodo")}</th>}
              {visibleColumns.paid && <th className="px-3 py-2 text-center font-medium">{tt("col_pagado")}</th>}
              <th className="px-3 py-2 text-right font-medium">{tt("col_total")}</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map(({ employee, total }) => {
              const key = employee.id;
              // Cada input es no-controlado (defaultValue). Incluir el
              // período en la `key` de la fila fuerza un remonte (nuevo
              // defaultValue) cada vez que cambia la quincena visible —
              // si no, navegar a una quincena vacía dejaba el mismo
              // <input> montado mostrando los números de la anterior.
              const periodKeySuffix = `${period.year}-${period.month}-${period.half}`;
              return (
                <tr
                  key={`${key}-${periodKeySuffix}`}
                  className="group/row border-b border-border transition-colors last:border-0 hover:bg-muted/40 focus-within:bg-primary/[0.07]"
                >
                  <td className="sticky left-0 z-10 bg-background px-3 py-1.5 font-medium text-foreground">
                    <span className="absolute inset-y-0 left-0 w-0.5 scale-y-0 bg-primary transition-transform group-focus-within/row:scale-y-100" />
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} />
                      {employee.name}
                    </div>
                  </td>
                  {fieldColumns.map((c) => {
                    const value = (total.entry?.[c.key] ?? 0) as number;
                    // "Base" es SOLO LECTURA: sale del historial de sueldos
                    // (sueldo vigente de esta quincena ÷ 2), ya no se edita
                    // a mano en la tabla.
                    if (c.key === "basePayCents") {
                      // Solo lectura + en el azul del token "salario"
                      // (mismo color que la sección Salarios de Auditoría).
                      return (
                        <td
                          key={c.key}
                          className="px-2 py-1 text-right font-medium tabular-nums"
                          style={{
                            ...fieldCellStyle(c.category, fieldMinWidth(c)),
                            color: PAYROLL_CATEGORY.salario.color,
                          }}
                          title={tt("base_readonly_hint")}
                        >
                          {formatCents(value)}
                        </td>
                      );
                    }
                    const quantityMeta = QUANTITY_FIELD_META[c.key];
                    if (quantityMeta) {
                      const quantity = (total.entry?.[quantityMeta.quantityField] ?? 0) as number;
                      return (
                        <td key={c.key} className="px-1 py-1" style={fieldCellStyle(c.category, fieldMinWidth(c))}>
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={quantity ? quantity.toString() : ""}
                                placeholder="0"
                                onBlur={(e) => saveQuantityField(key, quantityMeta.quantityField, e.target.value)}
                                className="w-14 rounded-md border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none"
                              />
                              <span className="text-xs text-muted-foreground">{quantityMeta.unit}</span>
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{formatCents(value)}</span>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="px-1 py-1" style={fieldCellStyle(c.category, fieldMinWidth(c))}>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={value ? (value / 100).toFixed(2) : ""}
                          placeholder="0.00"
                          onBlur={(e) => saveField(key, c.key, e.target.value)}
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none"
                        />
                      </td>
                    );
                  })}
                  {visibleColumns.paymentMethod && (
                    <td className="px-2 py-1">
                      <Select
                        value={total.entry?.paymentMethod ?? "efectivo"}
                        onValueChange={(v) => savePaymentMethod(key, v as PaymentMethod)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => (
                            <SelectItem key={value} value={value}>
                              {PAYMENT_METHOD_LABEL[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {visibleColumns.paid && (
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={total.entry?.paid ?? false}
                        onChange={(e) => togglePaid(key, e.target.checked)}
                        className="size-4 rounded border-input accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-foreground">
                    {formatCents(total.totalCents)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      title={tt("view_detail_annual")}
                      onClick={() => onViewDetail(employee.id)}
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows && rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-muted/30 text-sm font-medium">
                <td className="px-3 py-2 text-foreground" colSpan={visibleCount}>
                  {tt("total_quincena")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatCents(rows.reduce((sum, r) => sum + r.total.totalCents, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pending && <p className="text-xs text-muted-foreground">{tt("loading")}</p>}
    </div>
  );
}
