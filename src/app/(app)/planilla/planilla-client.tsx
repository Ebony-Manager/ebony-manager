"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tt("title")}</h1>
          <p className="text-sm text-muted-foreground">{tt("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tt("add_employee")}
        </Button>
      </div>

      <Tabs defaultValue="registro">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">{tt("tab_dashboard")}</TabsTrigger>
          <TabsTrigger value="panorama">{tt("tab_panorama")}</TabsTrigger>
          <TabsTrigger value="registro">{tt("tab_registro")}</TabsTrigger>
          <TabsTrigger value="auditoria">{tt("tab_auditoria")}</TabsTrigger>
          <TabsTrigger value="empleados">{tt("tab_empleados")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="pt-4">
          <DashboardView year={year} onYearChange={setYear} />
        </TabsContent>
        <TabsContent value="panorama" className="pt-4">
          <PanoramaView />
        </TabsContent>
        <TabsContent value="registro" className="pt-4">
          <RegistroView
            employees={employees}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={setVisibleColumns}
            onViewDetail={setDetailEmployeeId}
          />
        </TabsContent>
        <TabsContent value="auditoria" className="pt-4">
          <AuditoriaView year={year} onYearChange={setYear} />
        </TabsContent>
        <TabsContent value="empleados" className="pt-4">
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
  );
}
