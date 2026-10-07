"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Columns3,
  Wallet,
  Banknote,
  Award,
  TrendingDown,
  CalendarClock,
  Palette,
  Rows3,
  Check,
} from "lucide-react";
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
import { currentPeriod, nextPeriod, formatCents, monthLabel, type Period } from "@/lib/planilla/payroll-period";
import {
  PAYROLL_FOOT_BG_CLASS,
  payrollHeadBgClass,
  PAYROLL_ROW_VEIL_CLASS,
  payrollCategoryInk,
  payrollExtremeColumnClass,
  payrollFieldHeaderStyle,
  payrollFieldCellStyle,
  type PayrollCategoryKey,
  type PayrollPalette,
} from "@/lib/planilla/payroll-colors";
import { computeRegistroSimpleTotals } from "@/lib/planilla/payroll-registro-totals";
import { matchesEmployeeQuery, numberEmployees } from "@/lib/planilla/employee-search";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import {
  getRegistroAction,
  upsertPayrollEntryAction,
  upsertPayrollQuantityFieldAction,
  duplicatePreviousPeriodAction,
} from "./actions";
import { COLUMN_DEFS, QUANTITY_FIELD_META, type ColumnKey, type FieldKey } from "./registro-columns";
import { RegistroKpiCard } from "./registro-kpi-card";
import { EmployeeSearchInput } from "./employee-search-input";
import { EmployeeAvatar } from "./employee-avatar";

type Row = Awaited<ReturnType<typeof getRegistroAction>>[number];

/** Fecha real de pago de una quincena — el 15 para la 1a mitad, el
 *  último día del mes para la 2a — solo para el label del KPI "Próximo
 *  pago". */
function periodPayDate(p: { year: number; month: number; half: 1 | 2 }): Date {
  return p.half === 1 ? new Date(p.year, p.month - 1, 15) : new Date(p.year, p.month, 0);
}

function fieldMinWidth(c: { key: FieldKey }): number {
  return QUANTITY_FIELD_META[c.key] ? 96 : 88;
}

/** Columnas de la vista Simple que son una suma (todas de solo lectura).
 *  Prestaciones usa el tono "decimo" (dorado) como color de la sección. */
type SimpleColumnKey = "base" | "bonificaciones" | "descuentos" | "prestaciones";
const SIMPLE_COLUMNS: {
  key: SimpleColumnKey;
  labelKey: "col_salario_base" | "col_bonificaciones" | "col_descuentos_simple" | "col_prestaciones_simple";
  category: PayrollCategoryKey;
}[] = [
  { key: "base", labelKey: "col_salario_base", category: "salario" },
  { key: "bonificaciones", labelKey: "col_bonificaciones", category: "bonos" },
  { key: "descuentos", labelKey: "col_descuentos_simple", category: "descuentos" },
  { key: "prestaciones", labelKey: "col_prestaciones_simple", category: "decimo" },
];

// Paleta y vista Simple/Expandida — cada una recuerda su propia elección
// por navegador, igual criterio que Contratistas. Sufijo `-v2`: los
// defaults cambiaron (Expandida + "a todo color"), y las claves viejas
// guardaban la elección anterior ("sober"/"simple") que, de leerse,
// taparía los defaults nuevos.
const PALETTE_STORAGE_KEY = "ebony:planilla-registro-palette-v2";
function readStoredPalette(): PayrollPalette | null {
  try {
    const v = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return v === "full" || v === "sober" ? v : null;
  } catch {
    return null;
  }
}

type RegistroView = "expanded" | "simple";
const VIEW_STORAGE_KEY = "ebony:planilla-registro-view-v2";
function readStoredView(): RegistroView | null {
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "expanded" || v === "simple" ? v : null;
  } catch {
    return null;
  }
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
  // `rows` recuerda A QUÉ quincena pertenecen los datos. Si `period` ya
  // cambió pero el fetch nuevo todavía no volvió, `rows.period` no
  // coincide con `period` y NO se pinta ninguna fila (ver `visibleRows`):
  // los inputs de cantidad son no-controlados, así que montarlos con
  // datos de otra quincena dejaría la cantidad "pegada" de la anterior y
  // un onBlur la persistiría en la quincena equivocada.
  const [rows, setRows] = React.useState<{ period: Period; data: Row[] } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [duplicating, setDuplicating] = React.useState(false);
  // Buscador de empleado: la tabla se queda solo con quien coincida.
  const [query, setQuery] = React.useState("");

  // Por defecto: vista Expandida y paleta "a todo color".
  const [palette, setPalette] = React.useState<PayrollPalette>("full");
  const [view, setView] = React.useState<RegistroView>("expanded");
  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    const storedPalette = readStoredPalette();
    if (storedPalette) setPalette(storedPalette);
    const storedView = readStoredView();
    if (storedView) setView(storedView);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    } catch {
      /* ignore */
    }
  }, [palette]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Closures sobre `palette` — mismo nombre y firma que antes, así los
  // call-sites de la tabla no cambian.
  function fieldHeaderStyle(category: PayrollCategoryKey | undefined, minWidth: number): React.CSSProperties {
    return payrollFieldHeaderStyle(category, minWidth, palette);
  }
  function fieldCellStyle(category: PayrollCategoryKey | undefined, minWidth: number): React.CSSProperties {
    return payrollFieldCellStyle(category, minWidth, palette);
  }
  // Columnas extremas (Empleado, Método, Pagado, Total): gris tenue opaco.
  // Encabezado: gris del pie en "sober", un paso más oscuro en "full". `VEIL` = realce gris neutro de fila.
  const extreme = payrollExtremeColumnClass();
  const headBg = payrollHeadBgClass(palette);
  const VEIL = PAYROLL_ROW_VEIL_CLASS;

  const load = React.useCallback(() => {
    const fetchedFor = period;
    startTransition(async () => {
      const data = await getRegistroAction(fetchedFor.year, fetchedFor.month, fetchedFor.half);
      setRows({ period: fetchedFor, data });
    });
  }, [period]);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month, period.half]);

  const samePeriod = (a: Period, b: Period) =>
    a.year === b.year && a.month === b.month && a.half === b.half;
  // Filas que se pintan: solo si los datos cargados son de la quincena
  // seleccionada ahora mismo. Mientras no coincidan -> null -> "cargando".
  const visibleRows = rows && samePeriod(rows.period, period) ? rows.data : null;
  // Período atado a los datos en pantalla — cinturón y tirantes: los
  // save* lo usan en vez del `period` del closure, así un guardado nunca
  // le atribuye un valor a una quincena distinta de la que se ve.
  const dataPeriod = rows?.period ?? period;
  // Numeración estable (se calcula sobre la lista COMPLETA, antes de
  // buscar) y filas que se pintan tras la búsqueda.
  const allRows = visibleRows ?? [];
  const employeeNumber = numberEmployees(allRows.map((r) => r.employee.id));
  const shownRows = allRows.filter((r) => matchesEmployeeQuery(r.employee.name, query));
  const searching = query.trim() !== "";
  const shownTotalCents = shownRows.reduce((sum, r) => sum + r.total.totalCents, 0);

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

  async function saveField(employeeId: string, p: Period, field: FieldKey, value: string) {
    const cents = Math.round(parseFloat(value || "0") * 100);
    await upsertPayrollEntryAction({
      employeeId,
      periodYear: p.year,
      periodMonth: p.month,
      periodHalf: p.half,
      [field]: cents,
    });
    load();
  }

  /** Las cuatro columnas de cantidad (Horas/Días Extra, Horas/Días
   *  Descontados) — el servidor deriva el monto de la tarifa actual del
   *  empleado y guarda ambos (ver actions.ts). */
  async function saveQuantityField(
    employeeId: string,
    p: Period,
    field: "extraHours" | "extraDays" | "horasDescontadas" | "diasDescontados",
    value: string
  ) {
    const quantity = parseFloat(value || "0");
    await upsertPayrollQuantityFieldAction({
      employeeId,
      periodYear: p.year,
      periodMonth: p.month,
      periodHalf: p.half,
      field,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    });
    load();
  }

  async function savePaymentMethod(employeeId: string, p: Period, paymentMethod: PaymentMethod) {
    await upsertPayrollEntryAction({
      employeeId,
      periodYear: p.year,
      periodMonth: p.month,
      periodHalf: p.half,
      paymentMethod,
    });
    load();
  }

  async function togglePaid(employeeId: string, p: Period, paid: boolean) {
    await upsertPayrollEntryAction({
      employeeId,
      periodYear: p.year,
      periodMonth: p.month,
      periodHalf: p.half,
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
      <div className="rounded-none border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
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
  const totalCents = (visibleRows ?? []).reduce((sum, r) => sum + r.total.totalCents, 0);
  const cashCents = (visibleRows ?? []).reduce(
    (sum, r) => sum + ((r.total.entry?.paymentMethod ?? "transferencia") === "efectivo" ? r.total.totalCents : 0),
    0
  );
  const decimoCents = (visibleRows ?? []).reduce((sum, r) => sum + (r.total.entry?.decimoPaidCents ?? 0), 0);
  const descuentosCents = (visibleRows ?? []).reduce(
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
  const thisYear = currentPeriod().year;
  const yearOptions = Array.from(new Set([...Array.from({ length: 5 }, (_, i) => thisYear - 3 + i), period.year])).sort(
    (a, b) => a - b
  );
  const nextPayLabel = periodPayDate(upcoming).toLocaleDateString(lang === "en" ? "en-US" : "es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-5">
        <RegistroKpiCard
          icon={Wallet}
          label={tt("kpi_total_due")}
          value={formatCents(totalCents)}
          sublabel={`${(visibleRows ?? []).length} ${tt("kpi_employees_count")}`}
        />
        <RegistroKpiCard
          icon={Banknote}
          label={tt("kpi_cash")}
          value={formatCents(cashCents)}
          sublabel={pct(cashCents)}
        />
        <RegistroKpiCard
          icon={Award}
          label={tt("kpi_decimo")}
          value={formatCents(decimoCents)}
          sublabel={pct(decimoCents)}
        />
        <RegistroKpiCard
          icon={TrendingDown}
          label={tt("kpi_deductions")}
          value={formatCents(descuentosCents)}
          sublabel={pct(descuentosCents)}
        />
        <RegistroKpiCard
          icon={CalendarClock}
          label={tt("kpi_next_pay")}
          value={nextPayLabel}
          sublabel={quincenaLabel(upcoming.half)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-none border border-border px-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          {/* Ir directo a una quincena: año + mes/quincena, sin apretar la
              flecha muchas veces. */}
          <Select
            value={String(period.year)}
            onValueChange={(v) => setPeriod((p) => ({ ...p, year: Number(v) }))}
          >
            <SelectTrigger
              aria-label={tt("period_year_label")}
              className="h-7 w-[78px] border-0 bg-transparent px-2 text-sm font-medium shadow-none"
            >
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
            <SelectTrigger
              aria-label={tt("period_pick_label")}
              className="h-7 w-[200px] border-0 bg-transparent px-2 text-sm font-medium shadow-none"
            >
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
        <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={duplicating}>
          <Copy className="size-3.5" />
          {tt("duplicate_prev")}
        </Button>
        <EmployeeSearchInput value={query} onChange={setQuery} />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          title={tt("registro_view_toggle_hint")}
          onClick={() => setView((v) => (v === "expanded" ? "simple" : "expanded"))}
        >
          <Rows3 className="size-3.5" />
          {view === "simple" ? tt("registro_view_simple") : tt("registro_view_expanded")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={view === "simple"}>
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={tt("palette_label")}
          title={tt("palette_toggle_hint")}
          onClick={() => setPalette((p) => (p === "full" ? "sober" : "full"))}
        >
          <Palette className="size-3.5" />
          {palette === "sober" ? tt("palette_sober") : tt("palette_full")}
        </Button>
      </div>

      {view === "expanded" && (
      <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className={`border-b border-border text-xs text-muted-foreground ${headBg}`}>
              {/* Columna "Empleado" congelada al hacer scroll horizontal,
                  igual que en la Auditoría (sticky left-0 + fondo propio
                  OPACO: nogal en "a todo color", blanco en "sober"). */}
              <th className={`sticky left-0 z-20 ${headBg} px-3 py-2 text-left font-medium`}>{tt("col_empleado")}</th>
              {fieldColumns.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 text-right font-medium"
                  style={fieldHeaderStyle(c.category, fieldMinWidth(c))}
                >
                  {t(lang, c.label)}
                </th>
              ))}
              {visibleColumns.paymentMethod && (
                <th className="px-3 py-2 text-left font-medium">{tt("col_metodo")}</th>
              )}
              {visibleColumns.paid && (
                <th className="px-3 py-2 text-center font-medium">{tt("col_pagado")}</th>
              )}
              <th className="px-3 py-2 text-right font-medium">{tt("col_total")}</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {shownRows.map(({ employee, total }) => {
              const key = employee.id;
              // Período de los datos que se están pintando (== `period`
              // mientras `visibleRows` no sea null). Los save* lo reciben
              // en vez de leer `period` del closure.
              const p = dataPeriod;
              // Los inputs son no-controlados (defaultValue): solo toman
              // el valor al MONTARSE. `visibleRows` ya garantiza que estos
              // datos son de `p`; incluir el período en la `key` fuerza
              // además un remonte al cambiar de quincena, así el
              // defaultValue se relee siempre. Cinturón y tirantes.
              const periodKeySuffix = `${p.year}-${p.month}-${p.half}`;
              return (
                <tr
                  key={`${key}-${periodKeySuffix}`}
                  className="group/row border-b border-border transition-colors last:border-0"
                >
                  {/* Columna "Empleado" congelada: fondo OPACO propio. El
                      realce de fila (hover / edición) es un velo gris
                      neutro pintado ENCIMA del fondo de cada celda
                      (`VEIL`), así se ve parejo en toda la fila — incluida
                      esta celda — sin atraso ni cambio de matiz. */}
                  <td className={`sticky left-0 z-10 ${extreme} px-3 py-1.5 font-medium text-foreground transition-colors ${VEIL}`}>
                    <span className="absolute inset-y-0 left-0 w-0.5 scale-y-0 bg-primary transition-transform group-focus-within/row:scale-y-100" />
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 shrink-0 text-right text-[11px] font-normal tabular-nums text-muted-foreground"
                        title={tt("emp_number_title")}
                      >
                        {employeeNumber.get(employee.id)}
                      </span>
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
                          className={`px-2 py-1 text-right font-medium tabular-nums ${VEIL}`}
                          style={{
                            ...fieldCellStyle(c.category, fieldMinWidth(c)),
                            color: payrollCategoryInk("salario"),
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
                        <td key={c.key} className={`px-1 py-1 ${VEIL}`} style={fieldCellStyle(c.category, fieldMinWidth(c))}>
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={quantity ? quantity.toString() : ""}
                                placeholder="0"
                                onBlur={(e) => {
                                  const raw = e.target.value.trim();
                                  const next = raw === "" ? 0 : parseFloat(raw);
                                  if (!Number.isFinite(next)) return;
                                  // Solo guarda si el valor REALMENTE cambió:
                                  // entrar y salir de la casilla sin escribir
                                  // nada no debe tocar la base.
                                  if (Math.abs(next - (quantity || 0)) < 1e-9) return;
                                  saveQuantityField(key, p, quantityMeta.quantityField, e.target.value);
                                }}
                                className="w-14 rounded-none border border-transparent bg-transparent px-1 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none"
                              />
                              <span className="text-xs text-muted-foreground">{quantityMeta.unit}</span>
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{formatCents(value)}</span>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className={`px-1 py-1 ${VEIL}`} style={fieldCellStyle(c.category, fieldMinWidth(c))}>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={value ? (value / 100).toFixed(2) : ""}
                          placeholder="0.00"
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const nextCents = raw === "" ? 0 : Math.round(parseFloat(raw) * 100);
                            if (!Number.isFinite(nextCents)) return;
                            // Igual que las cantidades: sin cambio real
                            // respecto a lo guardado, no se escribe.
                            if (nextCents === (value || 0)) return;
                            saveField(key, p, c.key, e.target.value);
                          }}
                          className="w-full rounded-none border border-transparent bg-transparent px-2 py-1 text-right tabular-nums hover:border-input focus:border-ring focus:bg-background focus:outline-none"
                        />
                      </td>
                    );
                  })}
                  {visibleColumns.paymentMethod && (
                    <td className={`${extreme} px-2 py-1 ${VEIL}`}>
                      <Select
                        value={total.entry?.paymentMethod ?? "transferencia"}
                        onValueChange={(v) => {
                          if ((v as PaymentMethod) === (total.entry?.paymentMethod ?? "transferencia")) return;
                          savePaymentMethod(key, p, v as PaymentMethod);
                        }}
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
                    <td className={`${extreme} px-3 py-1.5 text-center ${VEIL}`}>
                      <input
                        type="checkbox"
                        checked={total.entry?.paid ?? false}
                        onChange={(e) => {
                          if (e.target.checked === (total.entry?.paid ?? false)) return;
                          togglePaid(key, p, e.target.checked);
                        }}
                        className="size-4 rounded-none border-input accent-primary"
                      />
                    </td>
                  )}
                  <td className={`${extreme} px-3 py-1.5 text-right font-medium tabular-nums text-foreground ${VEIL}`}>
                    {formatCents(total.totalCents)}
                  </td>
                  <td className={`px-2 py-1.5 text-right ${VEIL}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 hover:bg-[var(--payroll-row-veil-focus)]"
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
          {visibleRows && shownRows.length > 0 && (
            <tfoot>
              <tr className={`border-t border-ink-900/8 ${PAYROLL_FOOT_BG_CLASS} text-sm font-medium`}>
                <td className={`sticky left-0 z-10 ${PAYROLL_FOOT_BG_CLASS} px-3 py-2 text-foreground`} colSpan={visibleCount}>
                  {searching ? `${tt("emp_search_total")} (${shownRows.length})` : tt("total_quincena")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatCents(shownTotalCents)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}

      {/* Vista Simple — lo esencial de cada quincena en solo lectura (salvo
          Método y Pagado): Empleado, Función, Salario base y las TRES
          sumas que explican el total — Bonificaciones, Descuentos y
          Prestaciones (ver `computeRegistroSimpleTotals`, con test). Para
          capturar Horas Extra, Bonos, Días Libres, Décimo y el resto hay
          que pasar a Expandida — nada de esto se perdió, solo dejó de ser
          lo primero que se ve. Sigue siendo <table> real: colgroup con
          anchos relativos y semántica de tabla. */}
      {view === "simple" && (
        <div className="overflow-x-auto rounded-xl border border-ink-900/8 bg-card">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className={`border-b border-ink-900/8 ${headBg}`}>
                <th className={`sticky left-0 z-10 ${headBg} py-[11px] pl-[18px] pr-3 text-left text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase`}>
                  {tt("col_empleado")}
                </th>
                <th className="px-3 py-[11px] text-left text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase">
                  {tt("col_funcion")}
                </th>
                {SIMPLE_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 py-[11px] text-right text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase"
                    style={{ ...fieldHeaderStyle(c.category, 0), minWidth: undefined }}
                  >
                    {tt(c.labelKey)}
                  </th>
                ))}
                <th className="px-3 py-[11px] text-right text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase">
                  {tt("col_total")}
                </th>
                <th className="px-3 py-[11px] text-center text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase">
                  {tt("col_pagado")}
                </th>
                <th className="px-3 py-[11px] text-left text-[10.5px] font-semibold tracking-[0.04em] text-ink-900/60 uppercase">
                  {tt("col_metodo")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map(({ employee, total }) => {
                const key = employee.id;
                const p = dataPeriod;
                const e = total.entry;
                const sums = computeRegistroSimpleTotals(e);
                const amounts: Record<SimpleColumnKey, number> = {
                  base: sums.baseCents,
                  bonificaciones: sums.bonificacionesCents,
                  descuentos: -sums.descuentosCents,
                  prestaciones: sums.prestacionesCents,
                };
                return (
                  <tr
                    key={`${key}-simple-${p.year}-${p.month}-${p.half}`}
                    className="group/row border-b border-ink-900/6 transition-colors last:border-0"
                  >
                    {/* Sticky: fondo opaco propio; el realce de fila es el
                        mismo velo neutro que en el resto de celdas. */}
                    <td className={`sticky left-0 z-10 ${extreme} py-[13px] pl-[18px] pr-3 font-semibold text-ink-900 transition-colors ${VEIL}`}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-5 shrink-0 text-right text-[11px] font-normal tabular-nums text-muted-foreground"
                          title={tt("emp_number_title")}
                        >
                          {employeeNumber.get(employee.id)}
                        </span>
                        <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} />
                        <span className="text-[13px]">{employee.name}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-[13px] text-[12.5px] text-ink-900/65 ${VEIL}`}>
                      <span className="block max-w-[96px] truncate" title={employee.position || undefined}>
                        {employee.position || "—"}
                      </span>
                    </td>
                    {SIMPLE_COLUMNS.map((c) => {
                      const amount = amounts[c.key];
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-[13px] text-right text-[12.5px] tabular-nums ${VEIL}`}
                          style={{
                            ...fieldCellStyle(c.category, 0),
                            minWidth: undefined,
                            color: amount === 0 ? "var(--muted-foreground)" : palette === "full" ? payrollCategoryInk(c.category) : "var(--foreground)",
                          }}
                          title={c.key === "base" ? tt("base_readonly_hint") : undefined}
                        >
                          {amount === 0 ? "–" : formatCents(amount)}
                        </td>
                      );
                    })}
                    <td className={`${extreme} px-3 py-[13px] text-right text-[13.5px] font-bold tabular-nums text-ink-900 ${VEIL}`}>
                      {formatCents(total.totalCents)}
                    </td>
                    <td className={`${extreme} px-3 py-[13px] ${VEIL}`}>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={e?.paid ?? false}
                          aria-label={tt("col_pagado")}
                          onClick={() => togglePaid(key, p, !(e?.paid ?? false))}
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
                    <td className={`${extreme} px-3 py-[13px] ${VEIL}`}>
                      <Select
                        value={e?.paymentMethod ?? "transferencia"}
                        onValueChange={(v) => {
                          if ((v as PaymentMethod) === (e?.paymentMethod ?? "transferencia")) return;
                          savePaymentMethod(key, p, v as PaymentMethod);
                        }}
                      >
                        <SelectTrigger className="h-auto w-fit gap-1.5 rounded-[7px] border-ink-900/12 px-[9px] py-1 text-[12px] font-medium text-ink-900/60 shadow-none">
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
                  </tr>
                );
              })}
            </tbody>
            {visibleRows && shownRows.length > 0 && (
              <tfoot>
                <tr className={`border-t border-ink-900/8 ${PAYROLL_FOOT_BG_CLASS}`}>
                  <td className="py-3 pr-3 pl-3 text-right text-[12.5px] font-semibold text-ink-900/60" colSpan={6}>
                    {searching ? `${tt("emp_search_total")} (${shownRows.length})` : tt("total_quincena")}
                  </td>
                  <td className="px-3 py-3 text-right text-[14px] font-bold tabular-nums text-ink-900">
                    {formatCents(shownTotalCents)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {searching && visibleRows !== null && shownRows.length === 0 && (
        <p className="rounded-none border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {tt("emp_search_empty")}
        </p>
      )}

      {(pending || visibleRows === null) && (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      )}
    </div>
  );
}
