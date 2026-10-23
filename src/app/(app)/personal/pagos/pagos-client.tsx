"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor, ContractorContract, LaborRate, Project } from "@/types/contractors";
import type { MoneyRequest } from "@/types/money-requests";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageBreadcrumb, SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PendingBadge } from "@/components/shared/pending-badge";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AUDITORIA_VIEW_KEY, readSavedView } from "@/lib/planilla/saved-view";
import { AsistenciaView } from "../../planilla/asistencia-view";
import { RegistroView } from "../../planilla/registro-view";
import { AuditoriaView } from "../../planilla/auditoria-view";
import { MoneyRequestInbox } from "../../planilla/money-request-inbox";
import { EmployeeDetailSheet } from "../../planilla/employee-detail-sheet";
import { EmployeePhotosProvider } from "../../planilla/employee-photos-context";
import { AddChargeDialog, type ChargePerson } from "../../planilla/add-charge-dialog";
import { ChargeTypeChips, type ChargeTypeFilter } from "../../planilla/employee-charges-tab";
import type { CategoriaFilter } from "../../planilla/registro-columns";
import { sanitizeAuditoriaView } from "../../planilla/auditoria-view-state";
import { ContractorBalancesView } from "../../contratistas/contractor-balances-view";
import { ContractorClosingView } from "../../contratistas/contractor-closing-view";
import { ChargesListView } from "./charges-list-view";
import { ContractsView } from "../../contratistas/contracts-view";
import { LaborRatesView } from "../../contratistas/labor-rates-view";
import type { ContractorsDashboardInput } from "../../contratistas/contractors-dashboard-view";

type PagosTab = "asistencia" | "quincena" | "contratistas" | "prestamos" | "historial" | "contratos";
/** Préstamos: además de Taller / Administrativo, los de contratistas. */
type LoansFilter = CategoriaFilter | "contratistas";


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
 * Préstamos usa un tercero, que además ofrece "Contratistas" (sus préstamos
 * y adelantos salen del estado de cuenta, sin cuotas). `year` (Historial y la ventana del empleado) y
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
  contracts,
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
  contracts: ContractorContract[];
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
      { value: "prestamos", show: true },
      { value: "historial", show: canEmployees },
      { value: "contratos", show: canContractors },
    ] as const
  ).filter((x) => x.show);

  const [tab, setTabState] = React.useState<PagosTab>(() => {
    const found = TABS.find((x) => x.value === initialTab);
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
  const [registroCategoria, setRegistroCategoria] = React.useState<CategoriaFilter>("todos");
  const [auditoriaCategoria, setAuditoriaCategoria] = React.useState<CategoriaFilter>("todos");
  const [loansFilter, setLoansFilter] = React.useState<LoansFilter>(canEmployees ? "todos" : "contratistas");
  const [ratesOpen, setRatesOpen] = React.useState(false);
  const [chargeType, setChargeType] = React.useState<ChargeTypeFilter>("all");
  const [addChargeOpen, setAddChargeOpen] = React.useState(false);
  const router = useRouter();
  // A quiénes se les puede agregar un préstamo o descuento: los activos.
  const chargePeople = React.useMemo<ChargePerson[]>(
    () =>
      [
        ...employees.filter((e) => e.status === "ACTIVE").map((e) => ({ kind: "employee" as const, id: e.id, name: e.name })),
        ...(contractorsDashboard?.contractors ?? [])
          .filter((c) => c.status === "ACTIVE")
          .map((c) => ({ kind: "contractor" as const, id: c.id, name: c.name })),
      ].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [employees, contractorsDashboard]
  );

  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    const auditoria = readSavedView(AUDITORIA_VIEW_KEY, sanitizeAuditoriaView);
    if (auditoria) setAuditoriaCategoria(auditoria.categoria);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const detailEmployee = employees.find((e) => e.id === detailEmployeeId) ?? null;
  const byCategoria = (list: PayrollEmployee[], c: CategoriaFilter) =>
    c === "todos" ? list : list.filter((e) => e.categoria === c);

  // El selector Todos / Taller / Administrativo en las pestañas de
  // empleados; en Préstamos suma "Contratistas".
  const CATEGORIA_FILTERS: Array<{ value: CategoriaFilter; label: string }> = [
    { value: "todos", label: tp("categoria_filter_all") },
    { value: "taller", label: tp("categoria_taller") },
    { value: "administrativo", label: tp("categoria_administrativo") },
  ];
  const LOANS_FILTERS: Array<{ value: LoansFilter; label: string }> = [
    ...(canEmployees ? CATEGORIA_FILTERS : []),
    ...(canContractors ? [{ value: "contratistas" as const, label: tg("loans_contractors") }] : []),
  ];
  const showEmployeeLoans = canEmployees && loansFilter !== "contratistas";
  const showContractorLoans = canContractors && (loansFilter === "contratistas" || loansFilter === "todos");
  const loansCategoria: CategoriaFilter = loansFilter === "contratistas" ? "todos" : loansFilter;

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
          {tab === "quincena" && (
            <SegmentedFilter value={registroCategoria} options={CATEGORIA_FILTERS} onChange={setRegistroCategoria} />
          )}
          {tab === "historial" && (
            <SegmentedFilter value={auditoriaCategoria} options={CATEGORIA_FILTERS} onChange={setAuditoriaCategoria} />
          )}
          {tab === "prestamos" && LOANS_FILTERS.length > 1 && (
            <SegmentedFilter value={loansFilter} options={LOANS_FILTERS} onChange={setLoansFilter} />
          )}
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
                  onViewDetail={(id, initialTab) => {
                    setDetailTab(initialTab ?? "resumen");
                    setDetailEmployeeId(id);
                  }}
                  reloadSignal={registroReload}
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
          <TabsContent value="prestamos" className="pt-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <ChargeTypeChips value={chargeType} onChange={setChargeType} />
              <Button size="sm" onClick={() => setAddChargeOpen(true)}>
                <Plus className="size-3.5" />
                {tg("add")}
              </Button>
            </div>
            <MoneyRequestInbox
              requests={moneyRequests}
              employees={employees}
              contractors={contractors}
              canContractors={canContractors}
              onChanged={reload}
            />
            <ChargesListView
              employees={byCategoria(employees, loansCategoria)}
              contractors={contractorsDashboard}
              showEmployees={showEmployeeLoans}
              showContractors={showContractorLoans}
              typeFilter={chargeType}
              reloadSignal={registroReload}
              onOpenEmployee={(id) => {
                setDetailTab("prestamos");
                setDetailEmployeeId(id);
              }}
            />
          </TabsContent>
          {canContractors && (
            <>
              <TabsContent value="contratistas" className="pt-0">
                {/* Cierre de la quincena (como la Quincena de empleados) y los saldos. */}
                <Tabs defaultValue="cierre" className="gap-4">
                  <TabsList className="h-8 self-start">
                    <TabsTrigger value="cierre" className="px-3 text-xs">
                      {tg("sub_tab_closing")}
                    </TabsTrigger>
                    <TabsTrigger value="saldos" className="px-3 text-xs">
                      {tg("sub_tab_balances")}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="cierre" className="pt-0">
                    <ContractorClosingView />
                  </TabsContent>
                  <TabsContent value="saldos" className="pt-0">
                    {contractorsDashboard && <ContractorBalancesView input={contractorsDashboard} />}
                  </TabsContent>
                </Tabs>
              </TabsContent>
              <TabsContent value="contratos" className="pt-0">
                <ContractsView
                  contracts={contracts}
                  contractors={contractors.map((c) => ({ id: c.id, name: c.name, contractorType: c.contractorType }))}
                  projects={projects}
                  laborRates={laborRates}
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

        <AddChargeDialog
          open={addChargeOpen}
          onOpenChange={setAddChargeOpen}
          people={chargePeople}
          onSaved={() => {
            reload();
            router.refresh();
          }}
        />
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
