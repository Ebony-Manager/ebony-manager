"use client";

import * as React from "react";
import { CalendarX2, ChevronDown, CircleCheck, Clock, TrendingDown } from "lucide-react";

import { RankList, type RankItem } from "@/components/shared/rank-list";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { SectionHeader, Stepper } from "@/components/shared/page-header";
import { summarizeAttendance, type AttendanceEmployee, type AttendancePeriodRow, type AttendancePersonTotal } from "@/lib/planilla/attendance-summary";
import { currentPeriod, formatCents, monthLabel, type Period } from "@/lib/planilla/payroll-period";
import { employeeProfilePath, type EmployeeFrom } from "@/lib/personal/paths";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getAttendanceSummaryAction } from "./actions";

type Scope = "month" | "year";
type Categoria = "todos" | "taller" | "administrativo";

/** "3 h 20 min", "45 min", "2 h". */
function hoursLabel(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (!hh) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
const daysLabel = (d: number, lang: "es" | "en") => `${Number(d.toFixed(2))} ${lang === "en" ? (d === 1 ? "day" : "days") : d === 1 ? "día" : "días"}`;

/**
 * Resumen de asistencia: lo descontado por faltas y tardanzas en el mes o el
 * año, quién falta más, quién llega tarde más y quién no tuvo nada. Va en
 * Personal → Resumen (Todos y Empleados) y, plegado, en Pagos → Asistencia.
 */
export function AttendanceSummaryView({
  collapsible = false,
  from = "resumen",
  period,
}: {
  collapsible?: boolean;
  from?: EmployeeFrom;
  /** Con esto el resumen es de ESA quincena (la de arriba en Pagos → Asistencia) y no tiene selector propio. */
  period?: Period;
}) {
  const { lang } = useLang();
  const ta = (k: keyof typeof strings.attSummary) => t(lang, strings.attSummary[k]);
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const now = currentPeriod();
  const [scope, setScope] = React.useState<Scope>("month");
  const [year, setYear] = React.useState(now.year);
  const [month, setMonth] = React.useState(now.month);
  const [categoria, setCategoria] = React.useState<Categoria>("todos");
  const [open, setOpen] = React.useState(!collapsible);
  const [data, setData] = React.useState<Record<number, { employees: AttendanceEmployee[]; rows: AttendancePeriodRow[] } | "error">>({});

  React.useEffect(() => {
    if (!open || data[year]) return;
    let alive = true;
    getAttendanceSummaryAction(year)
      .then((d) => alive && setData((prev) => ({ ...prev, [year]: d })))
      .catch(() => alive && setData((prev) => ({ ...prev, [year]: "error" })));
    return () => {
      alive = false;
    };
  }, [open, year, data]);

  // Siguiendo la quincena de arriba: ese año, ese mes, esa quincena.
  const dataYear = period ? period.year : year;
  React.useEffect(() => {
    if (!period || period.year === year) return;
    setYear(period.year); // eslint-disable-line react-hooks/set-state-in-effect -- sigue la quincena de arriba.
  }, [period, year]);
  const loaded = data[dataYear];
  const summary =
    loaded && loaded !== "error"
      ? period
        ? summarizeAttendance(loaded.employees, loaded.rows, period.month, categoria, period.half)
        : summarizeAttendance(loaded.employees, loaded.rows, scope === "month" ? month : null, categoria)
      : null;

  const shiftMonth = (d: -1 | 1) => {
    const m = month + d;
    if (m < 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else if (m > 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth(m);
  };

  const item = (p: AttendancePersonTotal, display: string, value: number): RankItem => ({
    key: p.employee.id,
    label: p.employee.name,
    value,
    display,
    // Lo que pasó se ve siempre; quien ya no está, marcado.
    sub: p.employee.active ? undefined : ta("inactive"),
    href: employeeProfilePath(p.employee.id, from),
  });

  const controls = (
    <>
      {!period && (
      <SegmentedFilter
        value={scope}
        onChange={setScope}
        options={[
          { value: "month", label: ta("scope_month") },
          { value: "year", label: ta("scope_year") },
        ]}
      />
      )}
      {period ? null : scope === "month" ? (
        <Stepper label={`${monthLabel(lang, month)} ${year}`} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} className="[&>span]:min-w-28" />
      ) : (
        <Stepper label={year} onPrev={() => setYear((y) => y - 1)} onNext={() => setYear((y) => y + 1)} className="[&>span]:min-w-14" />
      )}
      <SegmentedFilter
        value={categoria}
        onChange={setCategoria}
        options={[
          { value: "todos", label: tp("categoria_filter_all") },
          { value: "taller", label: tp("categoria_taller") },
          { value: "administrativo", label: tp("categoria_administrativo") },
        ]}
      />
    </>
  );

  return (
    <section className="flex flex-col gap-3">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 self-start text-sm font-semibold text-foreground"
          aria-expanded={open}
        >
          <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          {ta("title")}
        </button>
      ) : (
        <SectionHeader title={ta("title")} subtitle={ta("subtitle")} />
      )}

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2">{controls}</div>

          {loaded === "error" ? (
            <p className="text-xs text-destructive">{tp("load_failed")}</p>
          ) : !summary ? (
            <p className="text-xs text-muted-foreground">{tp("loading")}</p>
          ) : summary.byAbsences.length === 0 && summary.byLateness.length === 0 && summary.spotless.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{period ? ta("empty_period") : ta("empty")}</p>
          ) : (
            <>
              {/* Totales en una línea, cada uno con su ícono de color. */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <span className="flex items-center gap-1.5">
                  <CalendarX2 className="size-4 text-destructive" />
                  <span className="font-semibold tabular-nums">{daysLabel(summary.days, lang)}</span>
                  <span className="text-muted-foreground">{ta("of_absence")}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4 text-warning" />
                  <span className="font-semibold tabular-nums">{hoursLabel(summary.hours)}</span>
                  <span className="text-muted-foreground">{ta("of_lateness")}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="size-4 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{formatCents(summary.cents)}</span>
                  <span className="text-muted-foreground">{ta("deducted")}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <RankList
                  title={ta("most_absences")}
                  icon={CalendarX2}
                  color="var(--destructive)"
                  items={summary.byAbsences.map((p) => item(p, daysLabel(p.days, lang), p.days))}
                  empty={ta("no_absences")}
                  moreLabel={ta("see_all")}
                  lessLabel={ta("see_less")}
                />
                <RankList
                  title={ta("most_lateness")}
                  icon={Clock}
                  color="var(--warning)"
                  items={summary.byLateness.map((p) => item(p, hoursLabel(p.hours), p.hours))}
                  empty={ta("no_lateness")}
                  moreLabel={ta("see_all")}
                  lessLabel={ta("see_less")}
                />
              </div>

              {summary.spotless.length > 0 && (
                <p className="flex items-start gap-1.5 text-sm">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>
                    <span className="font-medium">{ta("spotless")}</span>{" "}
                    <span className="text-muted-foreground">{summary.spotless.map((e) => (e.active ? e.name : `${e.name} (${ta("inactive")})`)).join(", ")}</span>
                  </span>
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
