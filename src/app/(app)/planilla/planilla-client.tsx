"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { RegistroView } from "./registro-view";
import { EmpleadosView } from "./empleados-view";
import { EmployeeFormDialog } from "./employee-form-dialog";
import {
  type ColumnKey,
  defaultVisibleColumns,
  REGISTRO_COLUMNS_STORAGE_KEY,
} from "./registro-columns";

/** Lee el set guardado de columnas de Registro desde localStorage —
 *  fuera del componente para que el efecto que lo llama sea un simple
 *  `if (x) setState(x)` (mismo patrón que language-context). */
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
 * Chrome del módulo Planilla para la Tanda B1: los dos tabs centrales
 * (Registro, Empleados) + "Agregar empleado". Resumen Anual, Auditoría,
 * Dashboard y Detalle llegan en la B2.
 *
 * `visibleColumns` vive acá (no dentro de RegistroView) y se persiste,
 * para que la elección sobreviva a cambiar de tab y a un reload —
 * RegistroView se desmonta al quedar su TabsContent inactivo.
 */
export function PlanillaClient({ employees }: { employees: PayrollEmployee[] }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [visibleColumns, setVisibleColumns] = React.useState(defaultVisibleColumns);

  /* eslint-disable react-hooks/set-state-in-effect -- post-hidratación: lee localStorage, no puede correr en el render del servidor. */
  React.useEffect(() => {
    const stored = readStoredColumns();
    if (stored) setVisibleColumns(stored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    try {
      window.localStorage.setItem(REGISTRO_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      // localStorage no disponible (modo privado, etc.) — no es crítico.
    }
  }, [visibleColumns]);

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
        <TabsList>
          <TabsTrigger value="registro">{tt("tab_registro")}</TabsTrigger>
          <TabsTrigger value="empleados">{tt("tab_empleados")}</TabsTrigger>
        </TabsList>
        <TabsContent value="registro" className="pt-4">
          <RegistroView
            employees={employees}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={setVisibleColumns}
          />
        </TabsContent>
        <TabsContent value="empleados" className="pt-4">
          <EmpleadosView employees={employees} />
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog mode="add" open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
