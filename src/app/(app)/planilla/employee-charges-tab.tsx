"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { LoanCategory, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { SegmentedFilter } from "@/components/shared/page-breadcrumb";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { LoansPanel } from "./loans-panel";
import { AddChargeDialog } from "./add-charge-dialog";

export const CHARGE_TYPES: LoanCategory[] = ["prestamo", "adelanto", "herramienta", "dano", "indrive", "otro", "tercero"];
export type ChargeTypeFilter = "all" | LoanCategory;

/** Chips Todos · Préstamos · Adelantos · Herramientas · Daños · InDrive · Otros · A terceros. */
export function ChargeTypeChips({ value, onChange }: { value: ChargeTypeFilter; onChange: (v: ChargeTypeFilter) => void }) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  return (
    <SegmentedFilter value={value} onChange={onChange} options={(["all", ...CHARGE_TYPES] as const).map((v) => ({ value: v, label: tg(`type_${v}`) }))} />
  );
}

/**
 * Pestaña "Préstamos y descuentos" del detalle del empleado: préstamos,
 * adelantos, herramientas, daños, InDrive y otros descuentos en una sola
 * lista (con chips para filtrar por tipo) y un solo botón "Agregar".
 */
export function EmployeeChargesTab({
  employee,
  loans,
  onChanged,
}: {
  employee: { id: string; name: string };
  loans: PayrollLoanWithSchedule[] | null;
  onChanged: () => void;
}) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  const [filter, setFilter] = React.useState<ChargeTypeFilter>("all");
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChargeTypeChips value={filter} onChange={setFilter} />
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {tg("add")}
        </Button>
      </div>

      <LoansPanel
        employeeId={employee.id}
        categories={filter === "all" ? CHARGE_TYPES : [filter]}
        loans={loans}
        onChanged={onChanged}
      />

      <AddChargeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        person={{ kind: "employee", id: employee.id, name: employee.name }}
        onSaved={onChanged}
      />
    </div>
  );
}
