"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  AlertTriangle,
  AlertOctagon,
  Filter,
  Layers,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Scale,
  Download,
} from "lucide-react";

import type { AuditoriaData, AuditoriaEmployeeRow, AuditFinding } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCents } from "@/lib/planilla/payroll-period";
import { monthShort, fmtSigned as fmtSignedHelper } from "@/lib/planilla/format";
import {
  PAYROLL_CATEGORY,
  PAYROLL_CATEGORY_LABEL_KEY,
  payrollCategoryRowStyle,
  type PayrollCategoryKey,
  type PayrollPalette,
} from "@/lib/planilla/payroll-colors";
import { useLang } from "@/context/language-context";
import { t, strings, type Lang } from "@/lib/i18n";
import { getAuditoriaDataAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";

const LEGEND_CATEGORIES: PayrollCategoryKey[] = [
  "salario",
  "decimo",
  "bonos",
  "descuentos",
  "descuentoPrestamos",
  "prestamos",
];

const GROUP_CATEGORY: Record<string, PayrollCategoryKey> = {
  salarios: "salario",
  prestaciones: "decimo",
  bonificaciones: "bonos",
  descuentos: "descuentos",
  prestamos_otros: "prestamos",
  descuento_prestamos: "descuentoPrestamos",
};

const GROUP_DEFS: { key: string; labelKey: keyof typeof strings.planilla }[] = [
  { key: "salarios", labelKey: "grp_salarios" },
  { key: "prestaciones", labelKey: "grp_prestaciones" },
  { key: "bonificaciones", labelKey: "grp_bonificaciones" },
  { key: "descuentos", labelKey: "grp_descuentos" },
  { key: "prestamos_otros", labelKey: "grp_prestamos_otros" },
  { key: "descuento_prestamos", labelKey: "grp_descuento_prestamos" },
];

function defaultVisibleGroups(): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const g of GROUP_DEFS) r[g.key] = true;
  return r;
}

const GROUPS_KEY = "ebony.planilla.auditoria.visibleGroups";
const PREVIEW_KEY = "ebony.planilla.auditoria.showPrestacionesPreview";
const BASE_KEY = "ebony.planilla.auditoria.showBaseComparison";
const PALETTE_KEY = "ebony.planilla.auditoria.palette";

type Densidad = "comprimida" | "expandida";
const DENSITY: Record<Densidad, { table: string; head: string; empRow: string; groupRow: string; lineRow: string }> = {
  comprimida: { table: "text-[11px]", head: "py-1", empRow: "py-1", groupRow: "py-0.5", lineRow: "py-0.5" },
  expandida: { table: "text-xs", head: "py-1.5", empRow: "py-1.5", groupRow: "py-1", lineRow: "py-1" },
};

type NivelDetalle = "macro" | "quincenal" | "concepto" | "micro";
const DETAIL_LEVELS: { key: NivelDetalle; labelKey: keyof typeof strings.planilla }[] = [
  { key: "macro", labelKey: "nivel_macro" },
  { key: "quincenal", labelKey: "nivel_quincenal" },
  { key: "concepto", labelKey: "nivel_concepto" },
  { key: "micro", labelKey: "nivel_micro" },
];

// Equivalentes OPACOS de bg-muted/40, bg-muted/30 y bg-foreground/90: las
// celdas sticky no pueden ser translúcidas, o los números que pasan por
// debajo al hacer scroll horizontal se ven a través de ellas.
const HEAD_BG = "bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))]";
const FOOT_BG = "bg-[color-mix(in_oklch,var(--muted)_30%,var(--card))]";
const TOTAL_DARK_BG = "bg-[color-mix(in_oklch,var(--foreground)_90%,var(--card))]";

function fmtSigned(cents: number): string {
  return fmtSignedHelper(cents, formatCents);
}

function periodLabelIdx(i: number): { month: number; half: 1 | 2 } {
  return { month: Math.floor(i / 2) + 1, half: ((i % 2) + 1) as 1 | 2 };
}

function toMonthly(periods: number[]): number[] {
  return Array.from({ length: 12 }, (_, m) => periods[m * 2] + periods[m * 2 + 1]);
}

function describeFinding(f: AuditFinding, lang: Lang): string {
  const tr = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  if (f.kind === "gap") {
    return tr("finding_gap")
      .replace("{a}", monthShort(lang, f.monthA ?? 1))
      .replace("{b}", `${monthShort(lang, f.monthB ?? 1)} ${f.year}`);
  }
  const q = f.half === 1 ? "1Q" : "2Q";
  const where = `${monthShort(lang, f.month ?? 1)} ${q} ${f.year}`;
  if (f.kind === "paid_zero") return `${where}: ${tr("finding_paid_zero")} ${formatCents(f.totalCents ?? 0)}.`;
  return `${where}: ${tr("finding_negative")} (${formatCents(f.totalCents ?? 0)}).`;
}

function downloadCsv(data: AuditoriaData, year: number, lang: Lang) {
  const header = [
    t(lang, strings.planilla.col_empleado),
    ...Array.from({ length: 24 }, (_, i) => {
      const { month, half } = periodLabelIdx(i);
      return `${monthShort(lang, month)} ${half}Q`;
    }),
    `${t(lang, strings.planilla.total_year)} ${year}`,
  ];
  const lines = [header.join(",")];
  for (const row of data.rows) {
    lines.push(
      [row.employee.name, ...row.periods.map((v) => (v / 100).toFixed(2)), (row.totalCents / 100).toFixed(2)].join(",")
    );
  }
  lines.push(
    [
      t(lang, strings.planilla.total_general).toUpperCase(),
      ...data.periodTotals.map((v) => (v / 100).toFixed(2)),
      (data.grandTotalCents / 100).toFixed(2),
    ].join(",")
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-planilla-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditoriaView({ year, onYearChange }: { year: number; onYearChange: (year: number) => void }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [data, setData] = React.useState<AuditoriaData | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [vista, setVista] = React.useState<Densidad>("comprimida");
  const [nivel, setNivel] = React.useState<NivelDetalle>("concepto");
  const [showInactive, setShowInactive] = React.useState(false);
  const [vistaOpen, setVistaOpen] = React.useState(false);
  const [filtroOpen, setFiltroOpen] = React.useState(false);
  const [employeeFilter, setEmployeeFilter] = React.useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState<"todos" | "activo" | "inactivo">("todos");
  const [visibleGroups, setVisibleGroups] = React.useState<Record<string, boolean>>(defaultVisibleGroups);
  const [showPrestacionesPreview, setShowPrestacionesPreview] = React.useState(true);
  const [showBaseComparison, setShowBaseComparison] = React.useState(true);
  // "sober" por defecto — la marca no tiene acento de color, así que la
  // vista sobria es la que se ve al abrir Auditoría.
  const [palette, setPalette] = React.useState<PayrollPalette>("sober");

  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    try {
      const g = window.localStorage.getItem(GROUPS_KEY);
      if (g) setVisibleGroups({ ...defaultVisibleGroups(), ...(JSON.parse(g) as Record<string, boolean>) });
      const p = window.localStorage.getItem(PREVIEW_KEY);
      if (p !== null) setShowPrestacionesPreview(p === "true");
      const b = window.localStorage.getItem(BASE_KEY);
      if (b !== null) setShowBaseComparison(b === "true");
      const pal = window.localStorage.getItem(PALETTE_KEY);
      if (pal === "full" || pal === "sober") setPalette(pal);
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(visibleGroups));
    } catch {
      /* ignore */
    }
  }, [visibleGroups]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(PREVIEW_KEY, String(showPrestacionesPreview));
      window.localStorage.setItem(BASE_KEY, String(showBaseComparison));
    } catch {
      /* ignore */
    }
  }, [showPrestacionesPreview, showBaseComparison]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(PALETTE_KEY, palette);
    } catch {
      /* ignore */
    }
  }, [palette]);

  const applyLevel = React.useCallback((level: NivelDetalle, d: AuditoriaData) => {
    if (level === "macro" || level === "quincenal") {
      setExpanded(new Set());
      setExpandedGroups(new Set());
    } else if (level === "concepto") {
      setExpanded(new Set(d.rows.map((r) => r.employee.id)));
      setExpandedGroups(new Set());
    } else {
      setExpanded(new Set(d.rows.map((r) => r.employee.id)));
      setExpandedGroups(new Set(d.rows.flatMap((r) => r.groups.map((g) => `${r.employee.id}-${g.key}`))));
    }
  }, []);

  React.useEffect(() => {
    getAuditoriaDataAction(year).then((d) => {
      setData(d);
      applyLevel(nivel, d);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  function setNivelMode(level: NivelDetalle) {
    setNivel(level);
    if (data) applyLevel(level, data);
  }

  const toggleSet = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleEmployee = toggleSet(setExpanded);
  const toggleGroup = toggleSet(setExpandedGroups);
  const toggleEmployeeFilter = toggleSet(setEmployeeFilter);

  function clearFiltros() {
    setEmployeeFilter(new Set());
    setStatusFilter("todos");
  }

  const isMonthly = nivel === "macro";
  const totalColumns = (isMonthly ? 12 : 24) + 2;
  const cols = isMonthly ? Array.from({ length: 12 }, (_, i) => i) : Array.from({ length: 24 }, (_, i) => i);
  const d = DENSITY[vista];
  const displayPeriods = (periods: number[]) => (isMonthly ? toMonthly(periods) : periods);

  function renderEmployeeRow(row: AuditoriaEmployeeRow) {
    const isOpen = expanded.has(row.employee.id);
    const visibleRowGroups = row.groups.filter((g) => visibleGroups[g.key] !== false);
    return (
      <React.Fragment key={row.employee.id}>
        <tr
          className="group/row cursor-pointer border-b border-border hover:bg-[var(--row-hover)]"
          onClick={() => toggleEmployee(row.employee.id)}
        >
          <td
            className={`sticky left-0 z-10 bg-card px-2 transition-colors group-hover/row:bg-[var(--row-hover)] ${d.empRow}`}
          >
            <div className="flex items-center gap-1.5">
              <ChevronDown className={`size-3 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              <EmployeeAvatar name={row.employee.name} employeeId={row.employee.id} sortOrder={row.employee.sortOrder} />
              <span className="whitespace-nowrap font-medium text-foreground">{row.employee.name}</span>
            </div>
          </td>
          {displayPeriods(row.periods).map((v, i) => (
            <td key={i} className={`px-1.5 ${d.empRow} text-right font-medium tabular-nums text-foreground`}>
              {v !== 0 ? formatCents(v) : "–"}
            </td>
          ))}
          <td className={`px-2 ${d.empRow} text-right font-semibold tabular-nums text-foreground`}>{formatCents(row.totalCents)}</td>
        </tr>
        {showBaseComparison && (
          <tr className="border-b border-border/50 text-[11px]">
            <td className={`sticky left-0 z-10 bg-card pl-8 pr-2 ${d.groupRow} italic text-muted-foreground`}>
              {tt("quincena_base")}
            </td>
            {displayPeriods(row.basePeriods).map((v, i) => {
              const totalV = displayPeriods(row.periods)[i];
              const differs = v !== totalV;
              return (
                <td
                  key={i}
                  className={`px-1.5 ${d.groupRow} text-right italic tabular-nums ${differs ? "text-muted-foreground" : "text-muted-foreground/50"}`}
                >
                  {v !== 0 ? formatCents(v) : "–"}
                </td>
              );
            })}
            <td className={`px-2 ${d.groupRow} text-right italic tabular-nums text-muted-foreground/70`}>
              {formatCents(row.basePeriods.reduce((s, v) => s + v, 0))}
            </td>
          </tr>
        )}
        {isOpen && (
          <tr aria-hidden style={{ height: 6 }}>
            <td className="sticky left-0 z-10 bg-card p-0" colSpan={totalColumns} />
          </tr>
        )}
        {isOpen &&
          visibleRowGroups.map((g, gi) => {
            const groupKey = `${row.employee.id}-${g.key}`;
            const groupOpen = expandedGroups.has(groupKey);
            // Categoría "real" del grupo (siempre el color de marca,
            // aparte de la paleta) — se usa para el puntito en "sober".
            const trueColor = PAYROLL_CATEGORY[GROUP_CATEGORY[g.key]].color;
            const { color, headerBg, lineBg, borderColor } = payrollCategoryRowStyle(GROUP_CATEGORY[g.key], palette);
            const isLastGroup = gi === visibleRowGroups.length - 1;
            const hasLineItems = groupOpen && g.lineItems.length > 0;
            const headerBorder: React.CSSProperties = {
              backgroundColor: headerBg,
              borderTop: `1px solid ${borderColor}`,
              borderBottom: hasLineItems ? "none" : `1px solid ${borderColor}`,
            };
            return (
              <React.Fragment key={g.key}>
                <tr className={`cursor-pointer text-[11px] ${d.groupRow}`} onClick={() => toggleGroup(groupKey)}>
                  <td
                    className={`sticky left-0 z-10 pl-8 pr-2 ${d.groupRow} ${hasLineItems ? "rounded-t-none" : "rounded-none"}`}
                    style={{ ...headerBorder, borderLeft: `1px solid ${borderColor}` }}
                  >
                    <div className="flex items-center gap-1">
                      <ChevronDown
                        className={`size-2.5 shrink-0 transition-transform ${groupOpen ? "" : "-rotate-90"}`}
                        style={{ color }}
                      />
                      {palette === "sober" && (
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: trueColor }}
                          aria-hidden
                        />
                      )}
                      <span className="whitespace-nowrap font-semibold" style={{ color }}>
                        {t(lang, strings.planilla[g.labelKey as keyof typeof strings.planilla])}
                      </span>
                    </div>
                  </td>
                  {displayPeriods(g.periods).map((v, i) => (
                    <td key={i} className={`px-1.5 ${d.groupRow} text-right font-medium tabular-nums`} style={{ ...headerBorder, color }}>
                      {v !== 0 ? fmtSigned(v) : "–"}
                    </td>
                  ))}
                  <td
                    className={`px-2 ${d.groupRow} text-right font-semibold tabular-nums ${hasLineItems ? "rounded-tr-none" : "rounded-tr-none rounded-br-none"}`}
                    style={{ ...headerBorder, borderRight: `1px solid ${borderColor}`, color }}
                  >
                    {fmtSigned(g.totalCents)}
                  </td>
                </tr>
                {groupOpen &&
                  g.lineItems.map((li, liI) => {
                    const isLastLine = liI === g.lineItems.length - 1;
                    const lineBorder: React.CSSProperties = {
                      backgroundColor: lineBg,
                      borderBottom: isLastLine ? `1px solid ${borderColor}` : "none",
                    };
                    // `li.periods` y `li.previewPeriods` vienen SIEMPRE en
                    // 24 quincenas; en Macro se pliegan a 12 meses para
                    // respetar las mismas columnas que el encabezado.
                    const perQuincena = li.periods.map((v, i) => {
                      const preview = li.previewPeriods?.[i];
                      const isPreview = v === 0 && showPrestacionesPreview && preview !== undefined && preview !== 0;
                      return { value: v !== 0 ? v : isPreview ? preview! : 0, isPreview };
                    });
                    const lineCells = isMonthly
                      ? Array.from({ length: 12 }, (_, m) => {
                          const a = perQuincena[m * 2];
                          const b = perQuincena[m * 2 + 1];
                          return {
                            value: a.value + b.value,
                            isPreview: (a.isPreview || a.value === 0) && (b.isPreview || b.value === 0) && (a.isPreview || b.isPreview),
                          };
                        })
                      : perQuincena;
                    return (
                      <tr key={li.key} className={`text-[11px] ${d.lineRow}`}>
                        <td
                          className={`sticky left-0 z-10 pl-14 pr-2 ${d.lineRow} text-foreground/80 ${isLastLine ? "rounded-bl-none" : ""}`}
                          style={{ ...lineBorder, borderLeft: `1px solid ${borderColor}` }}
                        >
                          {t(lang, strings.planilla[li.labelKey as keyof typeof strings.planilla])}
                        </td>
                        {lineCells.map(({ value, isPreview }, i) => (
                          <td
                            key={i}
                            className={`px-1.5 ${d.lineRow} text-right tabular-nums ${isPreview ? "italic text-muted-foreground/50" : "text-foreground/80"}`}
                            style={lineBorder}
                          >
                            {value !== 0 ? fmtSigned(value) : "–"}
                          </td>
                        ))}
                        <td
                          className={`px-2 ${d.lineRow} text-right tabular-nums text-foreground/80 ${isLastLine ? "rounded-br-none" : ""}`}
                          style={{ ...lineBorder, borderRight: `1px solid ${borderColor}` }}
                        >
                          {fmtSigned(li.totalCents)}
                        </td>
                      </tr>
                    );
                  })}
                {!isLastGroup && (
                  <tr aria-hidden style={{ height: 6 }}>
                    <td className="sticky left-0 z-10 bg-card p-0" colSpan={totalColumns} />
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        {isOpen && (
          <tr aria-hidden className="border-b border-border" style={{ height: 6 }}>
            <td className="sticky left-0 z-10 bg-card p-0" colSpan={totalColumns} />
          </tr>
        )}
      </React.Fragment>
    );
  }

  const filtroCount = employeeFilter.size + (statusFilter !== "todos" ? 1 : 0);
  const hiddenGroupCount = GROUP_DEFS.filter((g) => visibleGroups[g.key] === false).length;
  const filteredRows = (data?.rows ?? []).filter((r) => {
    if (employeeFilter.size > 0 && !employeeFilter.has(r.employee.id)) return false;
    if (statusFilter === "activo" && r.employee.status !== "ACTIVE") return false;
    if (statusFilter === "inactivo" && r.employee.status !== "INACTIVE") return false;
    return true;
  });
  const activeRows = filteredRows.filter((r) => r.employee.status === "ACTIVE");
  const inactiveRows = filteredRows.filter((r) => r.employee.status === "INACTIVE");
  const effectiveShowInactive = showInactive || statusFilter === "inactivo";
  const MONTHS = Array.from({ length: 12 }, (_, i) => monthShort(lang, i + 1));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-none bg-muted">
            <ClipboardCheck className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {tt("auditoria_title")} {year}
            </p>
            <p className="text-xs text-muted-foreground">{tt("auditoria_subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={filtroOpen} onOpenChange={setFiltroOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="size-3.5" />
                {tt("filtros")}
                {filtroCount > 0 ? ` (${filtroCount})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    {tt("col_empleado")}
                    {employeeFilter.size > 0 ? ` (${employeeFilter.size})` : ""}
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-none border border-border">
                    {(data?.rows ?? []).map((r) => (
                      <label
                        key={r.employee.id}
                        className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={employeeFilter.has(r.employee.id)}
                          onChange={() => toggleEmployeeFilter(r.employee.id)}
                        />
                        {r.employee.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-muted-foreground">{tt("estado")}</div>
                  <div className="flex items-center gap-0.5 rounded-none border border-border p-0.5 text-xs">
                    {(["todos", "activo", "inactivo"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatusFilter(s)}
                        className={`flex-1 rounded-none px-2 py-1 font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {s === "todos" ? tt("filtro_todos") : s === "activo" ? tt("filtro_activo") : tt("filtro_inactivo")}
                      </button>
                    ))}
                  </div>
                </div>
                {filtroCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFiltros}
                    className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {tt("limpiar_filtros")}
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="size-3.5" />
                {tt("secciones")}
                {hiddenGroupCount > 0 ? ` (${hiddenGroupCount})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {GROUP_DEFS.map((g) => (
                <DropdownMenuCheckboxItem
                  key={g.key}
                  checked={visibleGroups[g.key] !== false}
                  onCheckedChange={(checked) => setVisibleGroups((prev) => ({ ...prev, [g.key]: checked }))}
                >
                  {tt(g.labelKey)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={showPrestacionesPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPrestacionesPreview((v) => !v)}
          >
            <Sparkles className="size-3.5" />
            {tt("proyeccion_prestaciones")}
          </Button>

          <Button variant={showBaseComparison ? "default" : "outline"} size="sm" onClick={() => setShowBaseComparison((v) => !v)}>
            <Scale className="size-3.5" />
            {tt("comparar_base")}
          </Button>

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

          <Popover open={vistaOpen} onOpenChange={setVistaOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="size-3.5" />
                {tt("vista")}: {tt(DETAIL_LEVELS.find((l) => l.key === nivel)!.labelKey)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-muted-foreground">{tt("densidad")}</div>
                  <div className="flex items-center gap-0.5 rounded-none border border-border p-0.5 text-xs">
                    {(["comprimida", "expandida"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVista(v)}
                        className={`flex-1 rounded-none px-2 py-1 font-medium transition-colors ${vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {v === "comprimida" ? tt("comprimida") : tt("expandida")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-medium text-muted-foreground">{tt("nivel_detalle")}</div>
                  <div className="flex flex-col gap-0.5">
                    {DETAIL_LEVELS.map((l) => (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => setNivelMode(l.key)}
                        className={`rounded-none px-2 py-1.5 text-left font-medium transition-colors ${nivel === l.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        {tt(l.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" disabled={!data} onClick={() => data && downloadCsv(data, year, lang)}>
            <Download className="size-3.5" />
            {tt("exportar")}
          </Button>

          <div className="flex items-center gap-1 rounded-none border border-border px-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onYearChange(year - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 text-center text-sm font-medium text-foreground">{year}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onYearChange(year + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <p
        className="rounded-none px-3 py-2 text-xs text-muted-foreground"
        style={{ backgroundColor: "color-mix(in oklch, var(--payroll-next-pay) 12%, transparent)" }}
      >
        {isMonthly ? tt("auditoria_note_monthly") : tt("auditoria_note_biweekly")}
      </p>

      {data && data.findings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-none border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">
            {tt("findings_title")} ({data.findings.length})
          </p>
          {data.findings.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              {f.severity === "error" ? (
                <AlertOctagon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--payroll-pending)" }} />
              )}
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{f.employeeName}:</span> {describeFinding(f, lang)}
              </span>
            </div>
          ))}
        </div>
      )}

      {!data ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-border bg-card">
          <table
            className={`w-full ${isMonthly ? "min-w-[1000px]" : "min-w-[2200px]"} ${d.table}`}
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
          >
            {/* Encabezado: texto en el tono principal (no gris tenue), fondo
                OPACO, y el borde inferior va en cada <th> — con
                border-collapse: separate, un border en el <tr> no se pinta.
                La esquina Empleado (z-20) queda por encima de la primera
                columna del cuerpo (z-10). */}
            <thead className="text-foreground">
              {isMonthly ? (
                <tr>
                  <th
                    className={`sticky left-0 z-20 border-b border-border ${HEAD_BG} px-2 ${d.head} text-left text-xs font-semibold`}
                  >
                    {tt("col_empleado")}
                  </th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={i}
                      className={`border-b border-l border-border ${HEAD_BG} px-1.5 ${d.head} text-center text-xs font-semibold`}
                    >
                      {m}
                    </th>
                  ))}
                  <th
                    className={`border-b border-l border-border ${HEAD_BG} px-2 ${d.head} text-right text-xs font-semibold`}
                  >
                    {tt("total_year")} {year}
                  </th>
                </tr>
              ) : (
                <>
                  <tr>
                    <th
                      rowSpan={2}
                      className={`sticky left-0 z-20 border-b border-border ${HEAD_BG} px-2 ${d.head} text-left align-bottom text-xs font-semibold`}
                    >
                      {tt("col_empleado")}
                    </th>
                    {MONTHS.map((m, i) => (
                      <th
                        key={i}
                        colSpan={2}
                        className={`border-b border-l border-border ${HEAD_BG} px-1.5 ${d.head} text-center text-xs font-semibold`}
                      >
                        {m}
                      </th>
                    ))}
                    <th
                      rowSpan={2}
                      className={`border-b border-l border-border ${HEAD_BG} px-2 ${d.head} text-right align-bottom text-xs font-semibold`}
                    >
                      {tt("total_year")} {year}
                    </th>
                  </tr>
                  <tr>
                    {cols.map((i) => (
                      <th
                        key={i}
                        className={`border-b border-border ${HEAD_BG} px-1.5 ${d.head} text-center text-xs font-medium ${i % 2 === 0 ? "border-l" : ""}`}
                      >
                        {i % 2 === 0 ? "1Q" : "2Q"}
                      </th>
                    ))}
                  </tr>
                </>
              )}
            </thead>
            <tbody>
              <tr className={`border-b-2 border-border ${TOTAL_DARK_BG} text-background`}>
                <td className={`sticky left-0 z-10 ${TOTAL_DARK_BG} px-2 ${d.empRow} font-semibold uppercase tracking-wide`}>
                  {tt("total_planilla")}
                </td>
                {displayPeriods(data.periodTotals).map((v, i) => (
                  <td key={i} className={`px-1.5 ${d.empRow} text-right tabular-nums`}>
                    {formatCents(v)}
                  </td>
                ))}
                <td className={`px-2 ${d.empRow} text-right font-semibold tabular-nums`}>{formatCents(data.grandTotalCents)}</td>
              </tr>
            </tbody>
            <tbody>{activeRows.map(renderEmployeeRow)}</tbody>
            {inactiveRows.length > 0 && (
              <tbody>
                <tr
                  className={`cursor-pointer border-b border-border ${FOOT_BG}`}
                  onClick={() => setShowInactive((v) => !v)}
                >
                  <td colSpan={totalColumns} className={`sticky left-0 z-10 ${FOOT_BG} px-2 ${d.empRow}`}>
                    <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
                      <ChevronDown className={`size-3 shrink-0 transition-transform ${effectiveShowInactive ? "" : "-rotate-90"}`} />
                      {tt("no_longer_work_full")} ({inactiveRows.length})
                    </span>
                  </td>
                </tr>
                {effectiveShowInactive && inactiveRows.map(renderEmployeeRow)}
              </tbody>
            )}
            <tfoot>
              <tr className={`border-t-2 border-border ${FOOT_BG} font-semibold text-foreground`}>
                <td className={`sticky left-0 z-10 ${FOOT_BG} px-2 ${d.empRow}`}>{tt("total_general")}</td>
                {displayPeriods(data.periodTotals).map((v, i) => (
                  <td key={i} className={`px-1.5 ${d.empRow} text-right tabular-nums`}>
                    {formatCents(v)}
                  </td>
                ))}
                <td className={`px-2 ${d.empRow} text-right tabular-nums`}>{formatCents(data.grandTotalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {LEGEND_CATEGORIES.filter((k) => {
            const gk = Object.entries(GROUP_CATEGORY).find(([, cat]) => cat === k)?.[0];
            return !gk || visibleGroups[gk] !== false;
          }).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: PAYROLL_CATEGORY[k].color }} />
              {k === "decimo" ? tt("prestaciones") : t(lang, strings.planilla[PAYROLL_CATEGORY_LABEL_KEY[k]])}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
