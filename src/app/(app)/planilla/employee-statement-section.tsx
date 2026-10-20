"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import {
  buildEmployeeStatement,
  statementTotals,
  type StatementGranularity,
} from "@/lib/planilla/employee-statement";
import {
  PAYROLL_CATEGORY,
  payrollCategoryInk,
  payrollFieldCellStyle,
  payrollFieldHeaderStyle,
  type PayrollCategoryKey,
} from "@/lib/planilla/payroll-colors";
import { currentPeriod, formatCents, monthLabel } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { getEmployeeAnnualDetailAction } from "./actions";

type DetailRow = Awaited<ReturnType<typeof getEmployeeAnnualDetailAction>>[number];
type ColKey = "salary" | "bonus" | "deduction" | "given" | "paid";

const COLS: {
  key: ColKey;
  category: PayrollCategoryKey;
  label: keyof typeof strings.planilla;
  value: (r: ReturnType<typeof buildEmployeeStatement>[number]) => number;
  sign: "" | "−" | "+";
}[] = [
  { key: "salary", category: "salario", label: "cat_salario", value: (r) => r.salaryCents, sign: "" },
  { key: "bonus", category: "bonos", label: "cat_bonos", value: (r) => r.bonusCents, sign: "+" },
  { key: "deduction", category: "descuentos", label: "cat_descuentos", value: (r) => r.deductionCents, sign: "−" },
  { key: "given", category: "prestamos", label: "st_loans_given", value: (r) => r.loanGivenCents, sign: "" },
  { key: "paid", category: "descuentoPrestamos", label: "st_loans_paid", value: (r) => r.loanPaidCents, sign: "−" },
];

/**
 * "Estado de cuenta" del empleado — una sola tabla que junta salario,
 * bonificaciones, descuentos, préstamos otorgados y cuotas, con el neto
 * pagado y el saldo de préstamos. Por MES por defecto (menos abrumador) y
 * con opción quincenal; los interruptores de arriba esconden columnas.
 * Solo lectura: se alimenta de las mismas quincenas de Registro.
 */
export function EmployeeStatementSection({
  employee,
  initialDetail,
}: {
  employee: PayrollEmployee;
  /** El año actual ya cargado por el servidor al abrir la página. */
  initialDetail?: { year: number; rows: DetailRow[] };
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [year, setYear] = React.useState(() => currentPeriod().year);
  const [granularity, setGranularity] = React.useState<StatementGranularity>("month");
  const [shown, setShown] = React.useState<Record<ColKey, boolean>>({
    salary: true,
    bonus: true,
    deduction: true,
    given: true,
    paid: true,
  });
  const [detail, setDetail] = React.useState<{ year: number; rows: DetailRow[] } | null>(initialDetail ?? null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (initialDetail && initialDetail.year === year) return;
    let cancelled = false;
    getEmployeeAnnualDetailAction(employee.id, year)
      .then((rows) => {
        if (cancelled) return;
        setDetail({ year, rows });
        setFailed(false);
      })
      .catch((err) => {
        console.error("Planilla: no se pudo cargar el estado de cuenta", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id, year, initialDetail]);

  const rows = React.useMemo(
    () => (detail && detail.year === year ? buildEmployeeStatement(detail.rows, granularity, currentPeriod()) : null),
    [detail, year, granularity]
  );
  const totals = rows ? statementTotals(rows) : null;
  const visibleCols = COLS.filter((c) => shown[c.key]);
  const periodLabel = (r: { month: number; half: 1 | 2 | null }) =>
    r.half === null ? monthLabel(lang, r.month) : `${monthLabel(lang, r.month).slice(0, 3)} · ${r.half === 1 ? "1ra" : "2da"}`;

  const th = "px-3 py-2 text-right font-medium";
  const td = "px-3 py-1.5 text-right tabular-nums";

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{tt("st_title")}</h2>
          <p className="text-xs text-muted-foreground">{tt("st_subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 text-xs">
            {(["month", "quincena"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {g === "month" ? tt("st_view_month") : tt("st_view_quincena")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border px-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-12 text-center text-sm font-medium text-foreground">{year}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Interruptores: qué columnas ver. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {COLS.map((c) => {
          const on = shown[c.key];
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setShown((s) => ({ ...s, [c.key]: !s[c.key] }))}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-border bg-muted/40 text-foreground" : "border-dashed border-border text-muted-foreground line-through"}`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: PAYROLL_CATEGORY[c.category].color }} />
              {tt(c.label)}
            </button>
          );
        })}
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">{tt("load_failed")}</p>
      ) : rows === null ? (
        <p className="text-xs text-muted-foreground">{tt("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{tt("st_empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{tt("st_col_period")}</th>
                {visibleCols.map((c) => (
                  <th key={c.key} className={th} style={payrollFieldHeaderStyle(c.category, 0, "full")}>
                    {tt(c.label)}
                  </th>
                ))}
                <th className={`${th} text-muted-foreground`}>{tt("st_net")}</th>
                <th className={`${th} text-muted-foreground`}>{tt("st_balance")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className={`border-b border-border last:border-0 ${r.occurred ? "text-foreground" : "text-muted-foreground"}`}
                >
                  <td className="px-3 py-1.5">{periodLabel(r)}</td>
                  {visibleCols.map((c) => {
                    const v = c.value(r);
                    return (
                      <td
                        key={c.key}
                        className={td}
                        style={{
                          ...payrollFieldCellStyle(c.category, 0, "full"),
                          ...(v !== 0 && r.occurred ? { color: payrollCategoryInk(c.category) } : {}),
                        }}
                      >
                        {v === 0 ? "–" : `${c.sign}${formatCents(v)}`}
                      </td>
                    );
                  })}
                  <td className={`${td} font-medium`}>{formatCents(r.netCents)}</td>
                  <td className={td}>{formatCents(r.loanBalanceCents)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t border-border bg-[var(--payroll-foot)] font-medium text-foreground">
                  <td className="px-3 py-2">
                    {tt("st_total_row")} {year}
                  </td>
                  {visibleCols.map((c) => {
                    const v =
                      c.key === "salary"
                        ? totals.salaryCents
                        : c.key === "bonus"
                          ? totals.bonusCents
                          : c.key === "deduction"
                            ? totals.deductionCents
                            : c.key === "given"
                              ? totals.loanGivenCents
                              : totals.loanPaidCents;
                    return (
                      <td key={c.key} className={`${td}`}>
                        {v === 0 ? "–" : `${c.sign}${formatCents(v)}`}
                      </td>
                    );
                  })}
                  <td className={td}>{formatCents(totals.netCents)}</td>
                  <td className={td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {rows && rows.some((r) => !r.occurred) && <p className="text-xs text-muted-foreground">{tt("st_future_hint")}</p>}
    </section>
  );
}
