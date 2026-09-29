"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SectionSubbar, SectionSubbarTab } from "@/components/layout/section-subbar";
import { currentPeriod } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { RegistroView } from "./registro-view";
import { EmpleadosView } from "./empleados-view";
import { DashboardView } from "./dashboard-view";
import { PanoramaView } from "./panorama-view";
import { AuditoriaView } from "./auditoria-view";
import { EmployeeDetailSheet } from "./employee-detail-sheet";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { type ColumnKey, defaultVisibleColumns, REGISTRO_COLUMNS_STORAGE_KEY } from "./registro-columns";

/** Lee el set guardado de columnas de Registro desde localStorage. */
function readStoredColumns(): Record<ColumnKey, boolean> | null {
  try {
    const raw = window.localStorage.getItem(REGISTRO_COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
    return { ...defaultVisibleColumns(), ...parsed };
  } catch {
    return null;
  }
}

/**
 * Chrome del módulo Planilla (Fase 2 completa): Dashboard, Panorama,
 * Registro, Auditoría y Empleados, + el sheet de Detalle (abierto desde
 * Registro) y "Agregar empleado". La vieja pestaña "Resumen Anual" se
 * retiró (Taller · Tanda 1): su función la reemplaza el Historial dentro
 * del perfil de cada empleado (`/planilla/[id]`), que también es donde
 * "Empleados" navega ahora en vez de abrir un sheet. "Panorama" (Tanda 3)
 * es la misma idea en lenguaje simple, sin jerga — Dashboard sigue
 * siendo el panel financiero, sin tocar.
 *
 * `year` (Dashboard/Auditoría/Detalle) y `visibleColumns` (Registro,
 * persistido) viven acá para sobrevivir al cambio de tab.
 */
export function PlanillaClient({ employees }: { employees: PayrollEmployee[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [tab, setTab] = React.useState("registro");
  const [year, setYear] = React.useState(() => currentPeriod().year);
  const [detailEmployeeId, setDetailEmployeeId] = React.useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = React.useState(defaultVisibleColumns);

  /* eslint-disable react-hooks/set-state-in-effect -- lee localStorage post-hidratación. */
  React.useEffect(() => {
    const stored = readStoredColumns();
    if (stored) setVisibleColumns(stored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    try {
      window.localStorage.setItem(REGISTRO_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      /* ignore */
    }
  }, [visibleColumns]);

  const detailEmployee = employees.find((e) => e.id === detailEmployeeId) ?? null;

  const TABS = [
    { value: "dashboard", label: tt("tab_dashboard") },
    { value: "panorama", label: tt("tab_panorama") },
    { value: "registro", label: tt("tab_registro") },
    { value: "auditoria", label: tt("tab_auditoria") },
    { value: "empleados", label: tt("tab_empleados") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SectionSubbar
        tabs={TABS.map(({ value, label }) => (
          <SectionSubbarTab key={value} active={tab === value} onClick={() => setTab(value)}>
            {label}
          </SectionSubbarTab>
        ))}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            {tt("add_employee")}
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
        <p className="text-sm text-muted-foreground">{tt("subtitle")}</p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="dashboard" className="pt-0">
            <DashboardView year={year} onYearChange={setYear} />
          </TabsContent>
          <TabsContent value="panorama" className="pt-0">
            <PanoramaView />
          </TabsContent>
          <TabsContent value="registro" className="pt-0">
            <RegistroView
              employees={employees}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
              onViewDetail={setDetailEmployeeId}
            />
          </TabsContent>
          <TabsContent value="auditoria" className="pt-0">
            <AuditoriaView year={year} onYearChange={setYear} />
          </TabsContent>
          <TabsContent value="empleados" className="pt-0">
            <EmpleadosView employees={employees} />
          </TabsContent>
        </Tabs>

        <EmployeeDetailSheet
          employee={detailEmployee}
          year={year}
          open={detailEmployeeId !== null}
          onOpenChange={(open) => !open && setDetailEmployeeId(null)}
        />

        <EmployeeFormDialog mode="add" open={addOpen} onOpenChange={setAddOpen} />
      </div>
    </div>
  );
}
