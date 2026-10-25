"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Tags } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import type { Contractor, ContractorContract, LaborRate, Project } from "@/types/contractors";
import type { MoneyRequest } from "@/types/money-requests";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { PAGE_CLASS, PageHeader, SubTabs } from "@/components/shared/page-header";
import { PendingBadge } from "@/components/shared/pending-badge";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
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
  const tc = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

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
  const [contractAddOpen, setContractAddOpen] = React.useState(false);
  const [contractorsView, setContractorsView] = React.useState<"cierre" | "saldos">("cierre");
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
      <div className={PAGE_CLASS}>
        <PageHeader
          title={tg("title")}
          subtitle={tg(`sub_${tab}`)}
          action={
            tab === "prestamos" ? (
              <Button size="sm" onClick={() => setAddChargeOpen(true)}>
                <Plus className="size-3.5" />
                {tg("add")}
              </Button>
            ) : tab === "contratos" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setRatesOpen(true)}>
                  <Tags className="size-3.5" />
                  {tg("rates")}
                </Button>
                <Button size="sm" onClick={() => setContractAddOpen(true)}>
                  <Plus className="size-3.5" />
                  {tc("ct_add")}
                </Button>
              </>
            ) : null
          }
        />

        <SubTabs
          value={tab}
          onChange={setTab}
          tabs={TABS.map(({ value }) => ({
            value,
            label: tg(`tab_${value}`),
            badge: value === "prestamos" ? <PendingBadge count={moneyRequests.length} title={tp("mr_title")} /> : undefined,
          }))}
        />

        {/* El filtro de cada pestaña, a todo el ancho en el celular. */}
        {tab === "quincena" && <SegmentedFilter fill value={registroCategoria} options={CATEGORIA_FILTERS} onChange={setRegistroCategoria} />}
        {tab === "historial" && <SegmentedFilter fill value={auditoriaCategoria} options={CATEGORIA_FILTERS} onChange={setAuditoriaCategoria} />}
        {tab === "prestamos" && LOANS_FILTERS.length > 1 && (
          <SegmentedFilter fill value={loansFilter} options={LOANS_FILTERS} onChange={setLoansFilter} />
        )}

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
            <div className="mb-4">
              <ChargeTypeChips value={chargeType} onChange={setChargeType} />
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
                <div className="flex flex-col gap-4">
                  <SegmentedFilter
                    fill
                    value={contractorsView}
                    onChange={setContractorsView}
                    options={[
                      { value: "cierre", label: tg("sub_tab_closing") },
                      { value: "saldos", label: tg("sub_tab_balances") },
                    ]}
                  />
                  {contractorsView === "cierre" ? (
                    <ContractorClosingView />
                  ) : (
                    contractorsDashboard && <ContractorBalancesView input={contractorsDashboard} />
                  )}
                </div>
              </TabsContent>
              <TabsContent value="contratos" className="pt-0">
                <ContractsView
                  contracts={contracts}
                  contractors={contractors.map((c) => ({ id: c.id, name: c.name, contractorType: c.contractorType }))}
                  projects={projects}
                  laborRates={laborRates}
                  addOpen={contractAddOpen}
                  onAddOpenChange={setContractAddOpen}
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
