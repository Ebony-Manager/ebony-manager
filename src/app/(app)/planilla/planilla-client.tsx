"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import type { PayrollEmployee, PayrollPosition } from "@/types/planilla";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { breadcrumbFor } from "@/components/layout/nav-items";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { RegistroView } from "./registro-view";
import { EmpleadosView } from "./empleados-view";
import { DashboardView } from "./dashboard-view";
import { AuditoriaView } from "./auditoria-view";
import { EmployeeDetailSheet } from "./employee-detail-sheet";
import { EmployeePhotosProvider } from "./employee-photos-context";
import { EmployeeFormDialog } from "./employee-form-dialog";
import {
  type CategoriaFilter,
  defaultVisibleColumns,
  sanitizeRegistroView,
} from "./registro-columns";
import { sanitizeAuditoriaView } from "./auditoria-view-state";
import { AUDITORIA_VIEW_KEY, readSavedView, REGISTRO_VIEW_KEY } from "@/lib/planilla/saved-view";

/**
 * Chrome del módulo Planilla (Fase 2 completa, mockup Opción C): Dashboard,
 * Registro, Auditoría y Empleados, + el sheet de Detalle (abierto
 * desde Registro) y "Agregar empleado". La vieja pestaña "Resumen Anual" se
 * retiró (Taller · Tanda 1): su función la reemplaza el Historial dentro
 * del perfil de cada empleado (`/planilla/[id]`), que también es donde
 * "Empleados" navega ahora en vez de abrir un sheet. "Panorama" (Tanda 3)
 * es la misma idea en lenguaje simple, sin jerga — Dashboard sigue siendo
 * el panel financiero, sin tocar.
 *
 * Las pestañas ya NO viven en una franja nogal aparte (`SectionSubbar`,
 * retirado) — son texto simple con subrayado sobre el mismo fondo claro
 * de la página, como el resto de la pantalla en el mockup.
 *
 * `year` (Dashboard/Auditoría/Detalle) y `visibleColumns` (Registro) viven
 * acá para sobrevivir al cambio de tab. Lo que se abre por defecto es
 * "mi vista" guardada de cada pantalla (ver `lib/planilla/saved-view.ts`);
 * ya no se autoguarda cada cambio.
 *
 * El filtro de tipo de empleado (Taller/Administrativo/Todos) es POR
 * PANTALLA: Registro y Auditoría cada una el suyo (porque cada una lo
 * guarda en su vista); Empleados/Dashboard/Panorama comparten un tercero.
 * El selector del encabezado muestra y cambia el de la pestaña activa.
 * Registro filtra `employees` antes de recibirlos; Auditoría filtra sus
 * filas con el tipo de cada empleado.
 */
export function PlanillaClient({
  employees,
  positions,
  photoUrls,
}: {
  employees: PayrollEmployee[];
  positions: PayrollPosition[];
  photoUrls: Record<string, string>;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname, lang);

  const [addOpen, setAddOpen] = React.useState(false);
  const [tab, setTab] = React.useState("registro");
  const [year, setYear] = React.useState(() => currentPeriod().year);
  const [detailEmployeeId, setDetailEmployeeId] = React.useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = React.useState(defaultVisibleColumns);
  const [registroCategoria, setRegistroCategoria] = React.useState<CategoriaFilter>("todos");
  const [auditoriaCategoria, setAuditoriaCategoria] = React.useState<CategoriaFilter>("todos");
  const [otherCategoria, setOtherCategoria] = React.useState<CategoriaFilter>("todos");

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
  const registroEmployees = byCategoria(employees, registroCategoria);
  const otherEmployees = byCategoria(employees, otherCategoria);

  // El selector del encabezado actúa sobre la pestaña activa.
  const categoriaFilter =
    tab === "registro" ? registroCategoria : tab === "auditoria" ? auditoriaCategoria : otherCategoria;
  const setCategoriaFilter =
    tab === "registro" ? setRegistroCategoria : tab === "auditoria" ? setAuditoriaCategoria : setOtherCategoria;

  const CATEGORIA_FILTERS: Array<{ value: CategoriaFilter; label: string }> = [
    { value: "todos", label: tt("categoria_filter_all") },
    { value: "taller", label: tt("categoria_taller") },
    { value: "administrativo", label: tt("categoria_administrativo") },
  ];

  const TABS = [
    { value: "dashboard", label: tt("tab_dashboard") },
    { value: "registro", label: tt("tab_registro") },
    { value: "auditoria", label: tt("tab_auditoria") },
    { value: "empleados", label: tt("tab_empleados") },
  ];

  return (
    <EmployeePhotosProvider photoUrls={photoUrls}>
    <div className="flex flex-col gap-5 px-7 pt-6 pb-10">
      {crumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="-mt-2 flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={crumb} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-900/30">/</span>}
                <span className={isLast ? "font-semibold text-ink-900" : "text-ink-900/50"}>{crumb}</span>
              </span>
            );
          })}
        </nav>
      )}

      {/* Section tabs — texto simple con subrayado, sin franja de color. */}
      <div className="flex items-center gap-[22px] border-b border-ink-900/8">
        {TABS.map(({ value, label }) => {
          const isActive = tab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                isActive
                  ? "pb-[10px] text-[13.5px] font-semibold text-walnut border-b-2 border-walnut"
                  : "pb-[11px] text-[13.5px] font-medium text-ink-900/40 hover:text-ink-900/60"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Title row + filtro + acción. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[19px] font-bold text-ink-900">{tt("subtitle")}</h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-[9px] border border-ink-900/10 bg-white p-[3px]">
            {CATEGORIA_FILTERS.map(({ value, label }) => {
              const active = categoriaFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategoriaFilter(value)}
                  className={
                    active
                      ? "rounded-[6px] bg-walnut px-[13px] py-1.5 text-[12.5px] font-semibold text-white"
                      : "rounded-[6px] px-[13px] py-1.5 text-[12.5px] font-medium text-[#5b5b58]"
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="rounded-[9px] bg-walnut px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-walnut/90"
          >
            <Plus className="size-[15px]" />
            {tt("add_employee")}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="dashboard" className="pt-0">
          <DashboardView year={year} onYearChange={setYear} />
        </TabsContent>
        <TabsContent value="registro" className="pt-0">
          <RegistroView
            employees={registroEmployees}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={setVisibleColumns}
            categoria={registroCategoria}
            onCategoriaChange={setRegistroCategoria}
            onViewDetail={setDetailEmployeeId}
          />
        </TabsContent>
        <TabsContent value="auditoria" className="pt-0">
          <AuditoriaView
            year={year}
            onYearChange={setYear}
            categoria={auditoriaCategoria}
            onCategoriaChange={setAuditoriaCategoria}
          />
        </TabsContent>
        <TabsContent value="empleados" className="pt-0">
          <EmpleadosView employees={otherEmployees} />
        </TabsContent>
      </Tabs>

      <EmployeeDetailSheet
        employee={detailEmployee}
        year={year}
        open={detailEmployeeId !== null}
        onOpenChange={(open) => !open && setDetailEmployeeId(null)}
      />

      <EmployeeFormDialog mode="add" positions={positions} open={addOpen} onOpenChange={setAddOpen} />
    </div>
    </EmployeePhotosProvider>
  );
}
