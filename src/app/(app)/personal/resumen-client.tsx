"use client";

import * as React from "react";

import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, PageHeader } from "@/components/shared/page-header";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { AdminDashboardView } from "./admin-dashboard-view";
import { DashboardView } from "../planilla/dashboard-view";
import { AttendanceSummaryView } from "../planilla/attendance-summary-view";
import { ContractorsDashboardView, type ContractorsDashboardInput } from "../contratistas/contractors-dashboard-view";

export type ResumenView = "todos" | "empleados" | "contratistas";

/**
 * Personal → Resumen: un solo resumen con filtro. "Todos" es lo pagado por
 * mes entre empleados y contratistas (pide los dos módulos); "Empleados" y
 * "Contratistas" son los resúmenes que antes vivían dentro de Planilla y de
 * Contratistas. El filtro queda en la URL (`?ver=`) para que "Volver" desde
 * una ficha regrese a la misma vista.
 */
export function ResumenClient({
  canEmployees,
  canContractors,
  initialView,
  contractorsDashboard,
}: {
  canEmployees: boolean;
  canContractors: boolean;
  initialView: ResumenView | undefined;
  /** null si el usuario no tiene el módulo Contratistas. */
  contractorsDashboard: ContractorsDashboardInput | null;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.adminDash) => t(lang, strings.adminDash[k]);

  const options = [
    ...(canEmployees && canContractors ? [{ value: "todos" as const, label: tt("view_all") }] : []),
    ...(canEmployees ? [{ value: "empleados" as const, label: tt("view_employees") }] : []),
    ...(canContractors ? [{ value: "contratistas" as const, label: tt("view_contractors") }] : []),
  ];
  const [view, setViewState] = React.useState<ResumenView>(() =>
    options.some((o) => o.value === initialView) ? (initialView as ResumenView) : options[0].value
  );
  const setView = (next: ResumenView) => {
    setViewState(next);
    try {
      window.history.replaceState(null, "", `?ver=${next}`);
    } catch {
      /* ignore */
    }
  };
  const [year, setYear] = React.useState(() => currentPeriod().year);

  return (
    <div className={PAGE_CLASS}>
      <PageHeader title={tt("title")} subtitle={tt("subtitle")} />
      {options.length > 1 && <SegmentedFilter fill value={view} options={options} onChange={setView} />}
      {view === "todos" && <AdminDashboardView />}
      {view === "empleados" && <DashboardView year={year} onYearChange={setYear} />}
      {view === "contratistas" && contractorsDashboard && <ContractorsDashboardView input={contractorsDashboard} />}
      {/* Asistencia es de empleados (reloj y ponchadas): va dentro de Todos y de Empleados, no aparte. */}
      {canEmployees && (view === "todos" || view === "empleados") && <AttendanceSummaryView />}
    </div>
  );
}
