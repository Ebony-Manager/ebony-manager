"use client";

import * as React from "react";
import { Tags } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor, LaborRate, Project } from "@/types/contractors";
import type { MoneyRequest } from "@/types/money-requests";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageBreadcrumb, SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PendingBadge } from "@/components/shared/pending-badge";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AUDITORIA_VIEW_KEY, readSavedView, REGISTRO_VIEW_KEY } from "@/lib/planilla/saved-view";
import { AsistenciaView } from "../../planilla/asistencia-view";
import { RegistroView } from "../../planilla/registro-view";
import { AuditoriaView } from "../../planilla/auditoria-view";
import { LoansOverviewView } from "../../planilla/loans-overview-view";
import { MoneyRequestInbox } from "../../planilla/money-request-inbox";
import { EmployeeDetailSheet } from "../../planilla/employee-detail-sheet";
import { EmployeePhotosProvider } from "../../planilla/employee-photos-context";
import { type CategoriaFilter, defaultVisibleColumns, sanitizeRegistroView } from "../../planilla/registro-columns";
import { sanitizeAuditoriaView } from "../../planilla/auditoria-view-state";
import { ContractorBalancesView } from "../../contratistas/contractor-balances-view";
import { ProjectsView } from "../../contratistas/projects-view";
import { LaborRatesView } from "../../contratistas/labor-rates-view";
import type { ContractorsDashboardInput } from "../../contratistas/contractors-dashboard-view";

type PagosTab = "asistencia" | "quincena" | "contratistas" | "prestamos" | "historial" | "contratos";

/** Nombres de pestaña de la vieja Planilla, que pueden venir en enlaces guardados. */
const LEGACY_TABS: Record<string, PagosTab> = { registro: "quincena", auditoria: "historial" };

/**
 * Personal → Pagos: una sola fila de pestañas para todo lo que se le paga
 * al personal, en el orden del trabajo — Asistencia (el reloj → descuentos),
 * Quincena (la planilla de empleados), Contratistas (saldos), Préstamos (con
 * la bandeja de JotForm), Historial (todas las quincenas del año) y
 * Contratos (proyectos de contratistas, con Tarifas adentro). Reemplaza a
 * las viejas secciones Planilla y Contratistas; sus resúmenes pasaron al
 * Resumen de Personal.
 *
 * La pestaña vive en la URL (`?tab=`) para que "Volver" desde una ficha
 * regrese a la misma. El filtro Todos / Taller / Administrativo es por
 * pestaña de empleados: Quincena e Historial guardan el suyo en "mi vista";
 * Préstamos usa un tercero. `year` (Historial y la ventana del empleado) y
 * las columnas de Quincena viven acá para sobrevivir al cambio de pestaña.
 */
export function PagosClient({
  initialTab,
  canEmployees,
  canContractors,
  canAttendance,
  employees,
  photoUrls,
  moneyRequests,
  contractors,
  projects,
  laborRates,
  contractorsDashboard,
}: {
  initialTab: string | undefined;
  canEmployees: boolean;
  canContractors: boolean;
  canAttendance: boolean;
  employees: PayrollEmployee[];
  photoUrls: Record<string, string>;
  /** Solicitudes de dinero de JotForm por registrar (pestaña Préstamos). */
  moneyRequests: MoneyRequest[];
  contractors: Contractor[];
  projects: Project[];
  laborRates: LaborRate[];
  contractorsDashboard: ContractorsDashboardInput | null;
}) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const tp = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const TABS = (
    [
      { value: "asistencia", show: canEmployees && canAttendance },
      { value: "quincena", show: canEmployees },
      { value: "contratistas", show: canContractors },
      { value: "prestamos", show: canEmployees },
      { value: "historial", show: canEmployees },
      { value: "contratos", show: canContractors },
    ] as const
  ).filter((x) => x.show);

  const [tab, setTabState] = React.useState<PagosTab>(() => {
    const wanted = initialTab ? (LEGACY_TABS[initialTab] ?? initialTab) : null;
    const found = TABS.find((x) => x.value === wanted);
    return found ? found.value : canEmployees ? "quincena" : "contratistas";
  });
  const setTab = React.useCallback((value: PagosTab) => {
    setTabState(value);
    try {
      window.history.replaceState(null, "", `?tab=${value}`);
    } catch {
      /* ignore */
    }
  }, []);

  const [year, setYear] = React.useState(() => currentPeriod().year);
  const [detailEmployeeId, setDetailEmployeeId] = React.useState<string | null>(null);
  // Pestaña con la que se abre la ventana del empleado.
  const [detailTab, setDetailTab] = React.useState("resumen");
  // Sube cada vez que algo cambia lo que muestra la Quincena (o Préstamos).
  const [registroReload, setRegistroReload] = React.useState(0);
  const reload = () => setRegistroReload((n) => n + 1);
  const [visibleColumns, setVisibleColumns] = React.useState(defaultVisibleColumns);
  const [registroCategoria, setRegistroCategoria] = React.useState<CategoriaFilter>("todos");
  const [auditoriaCategoria, setAuditoriaCategoria] = React.useState<CategoriaFilter>("todos");
  const [loansCategoria, setLoansCategoria] = React.useState<CategoriaFilter>("todos");
  const [ratesOpen, setRatesOpen] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    const registro = readSavedView(REGISTRO_VIEW_KEY, sanitizeRegistroView);
    if (registro) {
      setVisibleColumns(registro.visibleColumns);
      setRegistroCategoria(registro.categoria);
    }
    const auditoria = readSavedView(AUDITORIA_VIEW_KEY, sanitizeAuditoriaView);
    if (auditoria) setAuditoriaCategoria(auditoria.categoria);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const detailEmployee = employees.find((e) => e.id === detailEmployeeId) ?? null;
  const byCategoria = (list: PayrollEmployee[], c: CategoriaFilter) =>
    c === "todos" ? list : list.filter((e) => e.categoria === c);

  // El selector Todos / Taller / Administrativo solo en las pestañas de empleados.
  const categoria =
    tab === "quincena"
      ? { value: registroCategoria, set: setRegistroCategoria }
      : tab === "historial"
        ? { value: auditoriaCategoria, set: setAuditoriaCategoria }
        : tab === "prestamos"
          ? { value: loansCategoria, set: setLoansCategoria }
          : null;
  const CATEGORIA_FILTERS: Array<{ value: CategoriaFilter; label: string }> = [
    { value: "todos", label: tp("categoria_filter_all") },
    { value: "taller", label: tp("categoria_taller") },
    { value: "administrativo", label: tp("categoria_administrativo") },
  ];

  return (
    <EmployeePhotosProvider photoUrls={photoUrls}>
      <div className="flex flex-col gap-5 px-7 pt-6 pb-10">
        <PageBreadcrumb />

        {/* Pestañas — texto simple con subrayado, sin franja de color. */}
        <div className="flex items-center gap-[22px] overflow-x-auto border-b border-ink-900/8">
          {TABS.map(({ value }) => {
            const isActive = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5",
                  isActive
                    ? "border-b-2 border-walnut pb-[10px] text-[13.5px] font-semibold text-walnut"
                    : "pb-[11px] text-[13.5px] font-medium text-ink-900/40 hover:text-ink-900/60"
                )}
              >
                {tg(`tab_${value}`)}
                {value === "prestamos" && <PendingBadge count={moneyRequests.length} title={tp("mr_title")} />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-bold text-ink-900">{tg(`tab_${tab}`)}</h1>
            <p className="text-xs text-muted-foreground">{tg(`sub_${tab}`)}</p>
          </div>
          {categoria && <SegmentedFilter value={categoria.value} options={CATEGORIA_FILTERS} onChange={categoria.set} />}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as PagosTab)}>
          {canEmployees && canAttendance && (
            <TabsContent value="asistencia" className="pt-0">
              <AsistenciaView onApplied={reload} />
            </TabsContent>
          )}
          {canEmployees && (
            <>
              <TabsContent value="quincena" className="pt-0">
                <RegistroView
                  employees={byCategoria(employees, registroCategoria)}
                  visibleColumns={visibleColumns}
                  onVisibleColumnsChange={setVisibleColumns}
                  categoria={registroCategoria}
                  onCategoriaChange={setRegistroCategoria}
                  onViewDetail={(id) => {
                    setDetailTab("resumen");
                    setDetailEmployeeId(id);
                  }}
                  reloadSignal={registroReload}
                />
              </TabsContent>
              <TabsContent value="prestamos" className="pt-0">
                <MoneyRequestInbox
                  requests={moneyRequests}
                  employees={employees}
                  contractors={contractors}
                  canContractors={canContractors}
                  onChanged={reload}
                />
                <LoansOverviewView
                  employees={byCategoria(employees, loansCategoria)}
                  reloadSignal={registroReload}
                  onOpenEmployee={(id, initialTab) => {
                    setDetailTab(initialTab);
                    setDetailEmployeeId(id);
                  }}
                />
              </TabsContent>
              <TabsContent value="historial" className="pt-0">
                <AuditoriaView
                  year={year}
                  onYearChange={setYear}
                  categoria={auditoriaCategoria}
                  onCategoriaChange={setAuditoriaCategoria}
                />
              </TabsContent>
            </>
          )}
          {canContractors && (
            <>
              <TabsContent value="contratistas" className="pt-0">
                {contractorsDashboard && <ContractorBalancesView input={contractorsDashboard} />}
              </TabsContent>
              <TabsContent value="contratos" className="pt-0">
                <ProjectsView
                  projects={projects}
                  actions={
                    <Button size="sm" variant="outline" onClick={() => setRatesOpen(true)}>
                      <Tags className="size-3.5" />
                      {tg("rates")}
                    </Button>
                  }
                />
              </TabsContent>
            </>
          )}
        </Tabs>

        {canEmployees && (
          <EmployeeDetailSheet
            employee={detailEmployee}
            year={year}
            initialTab={detailTab}
            open={detailEmployeeId !== null}
            onOpenChange={(open) => !open && setDetailEmployeeId(null)}
            onChanged={reload}
          />
        )}
        {canContractors && (
          <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
            <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{tg("rates_title")}</DialogTitle>
              </DialogHeader>
              <LaborRatesView rates={laborRates} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </EmployeePhotosProvider>
  );
}
