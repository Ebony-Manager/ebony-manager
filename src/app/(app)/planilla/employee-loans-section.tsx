"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import type { PayrollEmployee, PayrollLoanWithSchedule } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/shared/profile-card";
import { ICON } from "@/lib/ui/concepts";
import { formatCents } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { AddChargeDialog } from "./add-charge-dialog";
import { LoansPanel } from "./loans-panel";

const ALL_LOAN_TYPES = ["prestamo", "adelanto", "herramienta", "dano", "indrive", "otro", "tercero"] as const;

/**
 * "Préstamos y descuentos" de la ficha del empleado, con el mismo bloque que la del contratista: saldo
 * pendiente en el encabezado, "Agregar" a la derecha, lo vigente primero y los pagados detrás de
 * «Ver pagados». El historial de movimientos vive en el Estado de cuenta.
 */
export function EmployeeLoansSection({
  employee,
  loans,
}: {
  employee: PayrollEmployee;
  loans: PayrollLoanWithSchedule[];
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);

  // Lo que falta por descontar de lo vigente (los cancelados no cuentan).
  const owedCents = loans
    .filter((l) => l.status !== "cancelled")
    .reduce((sum, l) => sum + l.installments.filter((i) => !i.paid).reduce((s, i) => s + i.amountCents, 0), 0);
  const refresh = () => router.refresh();

  return (
    <ProfileCard
      icon={ICON.loans}
      title={tt("loans_title")}
      subtitle={
        <>
          {tt("loans_balance")}: <span className="font-medium text-foreground tabular-nums">{formatCents(owedCents)}</span>
        </>
      }
      action={
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />
          {t(lang, strings.pagos.add)}
        </Button>
      }
    >
      <LoansPanel employeeId={employee.id} categories={[...ALL_LOAN_TYPES]} loans={loans} onChanged={refresh} showBalance={false} />
      <AddChargeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        person={{ kind: "employee", id: employee.id, name: employee.name }}
        onSaved={refresh}
      />
    </ProfileCard>
  );
}
