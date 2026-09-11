"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, LogOut, Pencil, Settings, Trash2, UserCheck, UserX } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCents } from "@/lib/planilla/payroll-period";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateEmployeeAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { SalaryHistorySection } from "./salary-history-section";
import { EmployeeHistorySection } from "./employee-history-section";
import { LiquidationDialog } from "./liquidation-dialog";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

/**
 * Perfil del empleado a pantalla completa (Taller · Tanda 1) — mismo
 * patrón visual que `/contratistas/[id]`: volver + engranaje arriba,
 * tarjeta de encabezado, secciones apiladas debajo. Reemplaza al viejo
 * `EmployeeProfileSheet` como destino de "Empleados"; `EmployeeDetailSheet`
 * (con el ledger de préstamos, editable) sigue existiendo aparte, sin
 * tocar, para Registro.
 *
 * El engranaje revela los datos personales de siempre (mismo formulario,
 * `EmployeeFormDialog`, reubicado acá) + la CUENTA BANCARIA nueva (base
 * para el export a Banco General de una tanda futura) + estado/
 * liquidación/borrar.
 */
export function EmployeeProfileView({ employee }: { employee: PayrollEmployee }) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();

  const [editOpen, setEditOpen] = React.useState(false);
  const [liqOpen, setLiqOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [togglingStatus, setTogglingStatus] = React.useState(false);

  async function toggleStatus() {
    setTogglingStatus(true);
    try {
      await updateEmployeeAction(employee.id, {
        status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      toast.success(tt(employee.status === "ACTIVE" ? "mark_inactive" : "reactivate"));
      router.refresh();
    } finally {
      setTogglingStatus(false);
    }
  }

  const isInactive = employee.status === "INACTIVE";
  const hasBankAccount = Boolean(employee.bankName || employee.bankAccountType || employee.bankAccountNumber);
  const bankAccountTypeLabel =
    employee.bankAccountType === "ahorro"
      ? tt("bank_type_ahorro")
      : employee.bankAccountType === "corriente"
        ? tt("bank_type_corriente")
        : null;

  return (
    <>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
              <Link href="/planilla">
                <ArrowLeft className="size-3.5" />
                {tt("back_to_employees")}
              </Link>
            </Button>

            {/* Ajustes del empleado: datos personales + cuenta bancaria
                (discretos) + estado / liquidación / borrar. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label={tt("settings_menu")}
                  title={tt("settings_menu")}
                >
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {tt("details_title")}
                </DropdownMenuLabel>
                <div className="px-2 pb-1 text-xs">
                  <DetailRow label={tt("f_id_document")} value={employee.idDocument} />
                  <DetailRow
                    label={tt("f_phone")}
                    value={
                      employee.phone ? (
                        <a href={`tel:${employee.phone}`} className="hover:text-primary">
                          {employee.phone}
                        </a>
                      ) : null
                    }
                  />
                  <DetailRow label={tt("f_emg_name")} value={employee.emergencyContactName} />
                  <DetailRow
                    label={tt("f_emg_phone")}
                    value={
                      employee.emergencyContactPhone ? (
                        <a href={`tel:${employee.emergencyContactPhone}`} className="hover:text-primary">
                          {employee.emergencyContactPhone}
                        </a>
                      ) : null
                    }
                  />
                  <DetailRow label={tt("f_contract")} value={employee.contractInfo} />
                  <DetailRow
                    label={tt("f_start_date")}
                    value={employee.startDate ? formatDate(lang, employee.startDate) : null}
                  />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {tt("bank_section_title")}
                </DropdownMenuLabel>
                <div className="px-2 pb-1 text-xs">
                  {hasBankAccount ? (
                    <>
                      <DetailRow label={tt("f_bank_name")} value={employee.bankName} />
                      <DetailRow label={tt("f_bank_account_type")} value={bankAccountTypeLabel} />
                      <DetailRow label={tt("f_bank_account_number")} value={employee.bankAccountNumber} />
                    </>
                  ) : (
                    <p className="py-1 text-muted-foreground">{tt("no_bank_account")}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => window.setTimeout(() => setEditOpen(true), 0)}>
                  <Pencil className="size-3.5" />
                  {tt("action_edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {tt("status_label")}:{" "}
                  <span className="font-medium text-foreground">
                    {isInactive ? tt("inactive_label") : tt("active_label")}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => window.setTimeout(() => setLiqOpen(true), 0)}>
                  <LogOut className="size-3.5" />
                  {employee.endDate ? tt("liq_edit") : tt("liq_mark")}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={togglingStatus} onSelect={() => toggleStatus()}>
                  {isInactive ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
                  {isInactive ? tt("reactivate") : tt("mark_inactive")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => window.setTimeout(() => setDeleteOpen(true), 0)}
                >
                  <Trash2 className="size-3.5" />
                  {tt("delete_employee")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tarjeta de encabezado: nombre + posición a la izquierda,
              sueldo base a la derecha. */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} size="md" />
                <div>
                  <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    {employee.name}
                    {isInactive && <Badge variant="secondary">{tt("inactive")}</Badge>}
                  </h1>
                  <p className="text-sm text-muted-foreground">{employee.position || tt("no_position")}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-muted-foreground">{tt("base_salary_month")}</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {formatCents(employee.baseSalaryCents)}
                </p>
                <p className="text-xs text-muted-foreground">{tt("per_month")}</p>
              </div>
            </div>
          </Card>
        </div>

        {employee.notes && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {employee.notes}
          </div>
        )}

        {employee.liquidationNotes && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{tt("liq_notes_title")}: </span>
            <span className="whitespace-pre-wrap">{employee.liquidationNotes}</span>
          </div>
        )}

        <SalaryHistorySection employee={employee} />

        <EmployeeHistorySection employee={employee} />
      </div>

      <EmployeeFormDialog mode="edit" employee={employee} open={editOpen} onOpenChange={setEditOpen} />
      <LiquidationDialog
        employee={employee}
        open={liqOpen}
        onOpenChange={setLiqOpen}
        onSaved={() => router.refresh()}
      />
      <DeleteEmployeeDialog
        employee={employee}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/planilla")}
      />
    </>
  );
}
