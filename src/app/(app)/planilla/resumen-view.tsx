"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  LogOut,
  FileText,
  UserCheck,
  UserX,
  BarChart3,
  Coins,
  CheckCircle2,
  Clock,
  Gauge,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { PayrollEmployee, PayrollEmployeeAnnualSummary } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { periodKey, currentPeriod, periodOrdinal, formatCents } from "@/lib/planilla/payroll-period";
import { formatDate, monthShort } from "@/lib/planilla/format";
import {
  PAYROLL_CATEGORY,
  PAYROLL_CATEGORY_LABEL_KEY,
  payrollCategoryTint,
  payrollCategoryTextStyle,
  employeeAccentColor,
  type PayrollCategoryKey,
} from "@/lib/planilla/payroll-colors";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getAnnualSummaryAction, updateEmployeeAction, getEmployeeAnnualDetailAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";
import { LiquidationDialog } from "./liquidation-dialog";

const PROJECTING_STORAGE_KEY = "ebony:planilla-resumen-projecting";

type DetailRow = Awaited<ReturnType<typeof getEmployeeAnnualDetailAction>>[number];

const CONCEPT_BADGES: {
  key: keyof PayrollEmployeeAnnualSummary["conceptTotals"];
  labelKey: keyof typeof strings.planilla;
  category: PayrollCategoryKey;
}[] = [
  { key: "salarioCents", labelKey: "concept_salario_base", category: "salario" },
  { key: "decimoCents", labelKey: "concept_decimo", category: "decimo" },
  { key: "vacacionCents", labelKey: "concept_vacaciones", category: "vacacion" },
  { key: "primaCents", labelKey: "concept_prima", category: "prima" },
  { key: "descuentosCents", labelKey: "concept_descuentos", category: "descuentos" },
  { key: "prestamosCents", labelKey: "concept_prestamos", category: "prestamos" },
];

const LEGEND_CATEGORIES: PayrollCategoryKey[] = ["salario", "decimo", "vacacion", "prima", "descuentos", "prestamos"];
const CHART_HEIGHT = 96;

function StatBlock({
  icon: Icon,
  color,
  label,
  value,
  pct,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  pct?: number;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color }} />
      <div>
        <p className="whitespace-nowrap text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {value}
          {pct !== undefined && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{pct}%</span>}
        </p>
      </div>
    </div>
  );
}

function MonthlyBarChart({
  row,
  accent,
  projecting,
  year,
}: {
  row: PayrollEmployeeAnnualSummary;
  accent: string;
  projecting: boolean;
  year: number;
}) {
  const { lang } = useLang();
  const canProject = projecting && row.employee.status === "ACTIVE" && row.employee.baseSalaryCents > 0;
  const [projectedDetail, setProjectedDetail] = React.useState<DetailRow[] | null>(null);

  React.useEffect(() => {
    if (!canProject) return;
    let cancelled = false;
    getEmployeeAnnualDetailAction(row.employee.id, year, true).then((data) => {
      if (!cancelled) setProjectedDetail(data);
    });
    return () => {
      cancelled = true;
    };
  }, [canProject, row.employee.id, year]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthTotals = months.map(
    (m) => (row.totalsByPeriod[periodKey(m, 1)] ?? 0) + (row.totalsByPeriod[periodKey(m, 2)] ?? 0)
  );
  const current = currentPeriod();
  const currentOrdinal = periodOrdinal(current.year, current.month, current.half);

  function projectedMonthTotal(m: number): number {
    if (!projectedDetail) return 0;
    return projectedDetail.filter((r) => r.month === m).reduce((sum, r) => sum + r.totalCents, 0);
  }

  const allTotals = months.map((m, i) => {
    if (monthTotals[i] > 0) return monthTotals[i];
    const monthIsFuture = periodOrdinal(year, m, 1) > currentOrdinal;
    return canProject && monthIsFuture ? projectedMonthTotal(m) : 0;
  });
  const max = Math.max(...allTotals, 1);

  return (
    <div className="flex items-end gap-2 overflow-x-auto" style={{ height: CHART_HEIGHT + 34 }}>
      {months.map((m, i) => {
        const real = monthTotals[i];
        const monthIsFuture = periodOrdinal(year, m, 1) > currentOrdinal;
        const projected = !real && canProject && monthIsFuture ? projectedMonthTotal(m) : 0;
        const value = real || projected;
        const barHeight = value > 0 ? Math.max((value / max) * CHART_HEIGHT, 10) : 22;
        return (
          <div key={m} className="flex flex-1 flex-col items-center justify-end gap-1">
            {value > 0 && (
              <span
                className={`text-[10px] font-medium tabular-nums ${real ? "text-foreground" : "italic text-muted-foreground/60"}`}
              >
                {formatCents(value)}
              </span>
            )}
            <div
              className="w-full rounded-t-sm"
              style={
                real
                  ? { height: barHeight, backgroundColor: accent }
                  : projected
                    ? { height: barHeight, backgroundColor: `color-mix(in oklch, ${accent} 30%, transparent)` }
                    : { height: barHeight, border: "1px dashed var(--border)" }
              }
            />
            <span className="text-[10px] text-muted-foreground">{monthShort(lang, m)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ResumenView({
  year,
  onYearChange,
  onViewDetail,
}: {
  year: number;
  onYearChange: (year: number) => void;
  onViewDetail: (employeeId: string) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();

  const [rows, setRows] = React.useState<PayrollEmployeeAnnualSummary[] | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = React.useState(false);
  const [liquidationEmployee, setLiquidationEmployee] = React.useState<PayrollEmployee | null>(null);
  const [togglingStatusId, setTogglingStatusId] = React.useState<string | null>(null);

  const [projecting, setProjecting] = React.useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(PROJECTING_STORAGE_KEY) === "true") setProjecting(true);
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(PROJECTING_STORAGE_KEY, String(projecting));
    } catch {
      /* ignore */
    }
  }, [projecting]);

  const loadSummary = React.useCallback(() => {
    startTransition(async () => {
      const data = await getAnnualSummaryAction(year);
      setRows(data);
      setExpanded(new Set());
    });
  }, [year]);

  React.useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function handleToggleStatus(employee: PayrollEmployee) {
    setTogglingStatusId(employee.id);
    try {
      await updateEmployeeAction(employee.id, { status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      loadSummary();
      router.refresh();
    } finally {
      setTogglingStatusId(null);
    }
  }

  function toggleExpand(employeeId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  const active = (rows ?? []).filter((r) => r.employee.status === "ACTIVE");
  const inactive = (rows ?? []).filter((r) => r.employee.status === "INACTIVE");

  function renderCard(row: PayrollEmployeeAnnualSummary) {
    const isOpen = expanded.has(row.employee.id);
    const accent = employeeAccentColor(row.employee.sortOrder);
    const pendienteCents = row.totalPaidCents - row.paidCents;
    const monthsPending = 12 - row.monthsPaid;
    const pagadoPct = row.totalPaidCents > 0 ? Math.round((row.paidCents / row.totalPaidCents) * 100) : 0;
    const pendientePct = 100 - pagadoPct;
    const promMensualCents = row.monthsWithActivity > 0 ? Math.round(row.totalPaidCents / row.monthsWithActivity) : 0;

    return (
      <div
        key={row.employee.id}
        className="overflow-hidden rounded-xl border bg-card"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: accent,
          borderTopColor: `color-mix(in oklch, ${accent} 20%, var(--border))`,
          borderRightColor: `color-mix(in oklch, ${accent} 20%, var(--border))`,
          borderBottomColor: `color-mix(in oklch, ${accent} 20%, var(--border))`,
          backgroundColor: `color-mix(in oklch, ${accent} 5%, var(--card))`,
        }}
      >
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <button
            type="button"
            className="flex flex-1 flex-wrap items-center gap-4 text-left"
            onClick={() => toggleExpand(row.employee.id)}
          >
            <EmployeeAvatar name={row.employee.name} employeeId={row.employee.id} sortOrder={row.employee.sortOrder} size="md" />
            <div className="min-w-[150px]">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{row.employee.name}</span>
                <Badge variant={row.employee.status === "ACTIVE" ? "success" : "outline"}>
                  {row.employee.status === "ACTIVE" ? tt("active_label") : tt("inactive_label")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {tt("base_salary_month")}: {formatCents(row.employee.baseSalaryCents)} {tt("per_month")}
              </p>
              {row.employee.endDate && (
                <div
                  className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.employee.status === "INACTIVE" ? tt("liquidated_on") : tt("last_liquidation")}:{" "}
                  {formatDate(lang, row.employee.endDate)}
                  {row.employee.liquidationNotes && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          title={tt("liq_notes_title")}
                          className="text-muted-foreground/70 hover:text-foreground"
                        >
                          <FileText className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 text-xs">
                        <p className="mb-1 font-medium text-foreground">{tt("liq_notes_title")}</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">{row.employee.liquidationNotes}</p>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-5">
              <StatBlock icon={Coins} color="var(--payroll-total-due)" label={tt("stat_total_anual")} value={formatCents(row.totalPaidCents)} />
              <StatBlock
                icon={CheckCircle2}
                color="var(--payroll-paid)"
                label={`${tt("stat_pagado")} (${row.monthsPaid} ${tt("months_label")})`}
                value={formatCents(row.paidCents)}
                pct={pagadoPct}
              />
              <StatBlock
                icon={Clock}
                color="var(--payroll-pending)"
                label={`${tt("stat_pendiente")} (${monthsPending} ${tt("months_label")})`}
                value={formatCents(pendienteCents)}
                pct={pendientePct}
              />
              <StatBlock icon={Gauge} color="var(--payroll-avg)" label={tt("stat_prom_mensual")} value={formatCents(promMensualCents)} />
            </div>
          </button>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={row.employee.status === "ACTIVE" ? tt("mark_inactive") : tt("reactivate")}
              disabled={togglingStatusId === row.employee.id}
              onClick={() => handleToggleStatus(row.employee)}
            >
              {row.employee.status === "ACTIVE" ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title={row.employee.endDate ? tt("liq_edit") : tt("liq_mark")}
              onClick={() => setLiquidationEmployee(row.employee)}
            >
              <LogOut className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleExpand(row.employee.id)}>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </Button>
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-border bg-muted/10 px-4 py-4">
            <MonthlyBarChart row={row} accent={accent} projecting={projecting} year={year} />
            <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">{tt("desglose_concepto")}</p>
            <div className="flex flex-wrap items-center gap-2">
              {CONCEPT_BADGES.map((b) => (
                <div key={b.key} className="rounded-lg px-3 py-1.5" style={payrollCategoryTint(b.category, 12)}>
                  <p className="text-[11px] font-medium" style={payrollCategoryTextStyle(b.category)}>
                    {tt(b.labelKey)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCents(row.conceptTotals[b.key])}
                  </p>
                </div>
              ))}
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => onViewDetail(row.employee.id)}>
                {tt("view_detail")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BarChart3 className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">{tt("resumen_title")}</p>
            <p className="text-xs text-muted-foreground">{tt("resumen_subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border px-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onYearChange(year - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-16 text-center text-sm font-medium text-foreground">{year}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onYearChange(year + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button type="button" variant={projecting ? "default" : "outline"} size="sm" onClick={() => setProjecting((p) => !p)}>
            <TrendingUp className="size-3.5" />
            {tt("project_next")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">{active.map(renderCard)}</div>

      {inactive.length > 0 && (
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40"
            onClick={() => setShowInactive((v) => !v)}
          >
            <ChevronDown className={`size-3.5 shrink-0 transition-transform ${showInactive ? "" : "-rotate-90"}`} />
            {tt("no_longer_work_full")} ({inactive.length})
          </button>
          {showInactive && (
            <div className="flex flex-col gap-3 border-t border-border bg-muted/10 p-3">{inactive.map(renderCard)}</div>
          )}
        </div>
      )}

      {pending && <p className="text-xs text-muted-foreground">{tt("loading")}</p>}
      {!pending && active.length === 0 && inactive.length === 0 && (
        <p className="text-sm text-muted-foreground">{tt("no_employees_yet")}</p>
      )}

      {(active.length > 0 || inactive.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {LEGEND_CATEGORIES.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: PAYROLL_CATEGORY[k].color }} />
              {t(lang, strings.planilla[PAYROLL_CATEGORY_LABEL_KEY[k]])}
            </span>
          ))}
        </div>
      )}

      {liquidationEmployee && (
        <LiquidationDialog
          employee={liquidationEmployee}
          open={liquidationEmployee !== null}
          onOpenChange={(open) => !open && setLiquidationEmployee(null)}
          onSaved={loadSummary}
        />
      )}
    </div>
  );
}
