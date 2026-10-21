"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import type { LoanCategory, PayrollLedgerEntry, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { LoansPanel } from "./loans-panel";
import { OtherMovementsPanel } from "./other-movements-panel";
import { AddChargeDialog } from "./add-charge-dialog";
import type { LedgerPeriodOption } from "./ledger-entry-dialog";

export const CHARGE_TYPES: LoanCategory[] = ["prestamo", "adelanto", "herramienta", "dano", "indrive"];
export type ChargeTypeFilter = "all" | LoanCategory;

/** Chips Todos · Préstamos · Adelantos · Herramientas · Daños · InDrive. */
export function ChargeTypeChips({ value, onChange }: { value: ChargeTypeFilter; onChange: (v: ChargeTypeFilter) => void }) {
  const { lang } = useLang();
  const tg = (k: keyof typeof strings.pagos) => t(lang, strings.pagos[k]);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {(["all", ...CHARGE_TYPES] as const).map((v) => (
        <Button key={v} size="sm" variant={value === v ? "secondary" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => onChange(v)}>
          {tg(`type_${v}`)}
        </Button>
      ))}
    </div>
  );
}

/**
 * Pestaña "Préstamos y descuentos" del detalle del empleado: préstamos,
 * adelantos, herramientas, daños e InDrive en una sola lista (con chips para
 * filtrar por tipo) y un solo botón "Agregar". Abajo, los otros descuentos
 * sueltos (seguro social, carnet…), que no llevan cuotas.
 */
export function EmployeeChargesTab({
  employee,
  loans,
  ledger,
  periodOptions,
  onChanged,
}: {
  employee: { id: string; name: string };
  loans: PayrollLoanWithSchedule[] | null;
  ledger: PayrollLedgerEntry[] | null;
  periodOptions: LedgerPeriodOption[];
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

      {filter === "all" && (
        <div className="border-t border-border pt-3">
          <OtherMovementsPanel employeeId={employee.id} entries={ledger} periodOptions={periodOptions} onChanged={onChanged} />
        </div>
      )}

      <AddChargeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        person={{ kind: "employee", id: employee.id, name: employee.name }}
        onSaved={onChanged}
      />
    </div>
  );
}
