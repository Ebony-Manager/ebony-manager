"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Phone, LogOut, UserCheck, UserX, Trash2 } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/planilla/format";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateEmployeeAction } from "./actions";
import { EmployeeAvatar } from "./employee-avatar";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { SalaryHistorySection } from "./salary-history-section";
import { LiquidationDialog } from "./liquidation-dialog";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

/**
 * Perfil del empleado. Datos personales + sección "Sueldo / Aumentos"
 * (el único lugar donde se cambia el sueldo, registrando un aumento) +
 * "Estado / Liquidación" (activar/desactivar y marcar liquidación) +
 * "Zona de peligro" (borrar por completo, con confirmación).
 */
export function EmployeeProfileSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee: PayrollEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();

  const [editOpen, setEditOpen] = React.useState(false);
  const [liqOpen, setLiqOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [togglingStatus, setTogglingStatus] = React.useState(false);

  async function toggleStatus() {
    if (!employee) return;
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <div className="flex items-center gap-3">
              {employee && (
                <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} size="md" />
              )}
              <div>
                <SheetTitle>{employee?.name ?? ""}</SheetTitle>
                <SheetDescription>
                  {employee?.position || tt("profile_fallback")}
                  {employee?.status === "INACTIVE" && (
                    <Badge variant="secondary" className="ml-2 align-middle">
                      {tt("inactive")}
                    </Badge>
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 pb-6">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={!employee}>
                <Pencil className="size-3.5" />
                {tt("action_edit")}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
              <ProfileField label={tt("f_id_document")} value={employee?.idDocument} />
              <ProfileField
                label={tt("f_phone")}
                value={
                  employee?.phone ? (
                    <a href={`tel:${employee.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                      <Phone className="size-3.5" />
                      {employee.phone}
                    </a>
                  ) : null
                }
              />
              <ProfileField label={tt("f_emg_name")} value={employee?.emergencyContactName} />
              <ProfileField
                label={tt("f_emg_phone")}
                value={
                  employee?.emergencyContactPhone ? (
                    <a
                      href={`tel:${employee.emergencyContactPhone}`}
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      <Phone className="size-3.5" />
                      {employee.emergencyContactPhone}
                    </a>
                  ) : null
                }
              />
              <ProfileField label={tt("f_contract")} value={employee?.contractInfo} />
              <ProfileField
                label={tt("f_start_date")}
                value={employee?.startDate ? formatDate(lang, employee.startDate) : null}
              />
            </div>

            {employee?.notes && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {employee.notes}
              </div>
            )}

            {employee && <SalaryHistorySection employee={employee} />}

            {/* Estado / Liquidación */}
            {employee && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{tt("status_section_title")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {tt("status_label")}:{" "}
                      <span className="font-medium text-foreground">
                        {employee.status === "ACTIVE" ? tt("active_label") : tt("inactive_label")}
                      </span>
                      {employee.endDate && (
                        <>
                          {" · "}
                          {employee.status === "INACTIVE" ? tt("liquidated_on") : tt("last_liquidation")}:{" "}
                          {formatDate(lang, employee.endDate)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={toggleStatus} disabled={togglingStatus}>
                      {employee.status === "ACTIVE" ? (
                        <UserX className="size-3.5" />
                      ) : (
                        <UserCheck className="size-3.5" />
                      )}
                      {employee.status === "ACTIVE" ? tt("mark_inactive") : tt("reactivate")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLiqOpen(true)}>
                      <LogOut className="size-3.5" />
                      {employee.endDate ? tt("liq_edit") : tt("liq_mark")}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tt("status_hint")}</p>
                {employee.liquidationNotes && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{tt("liq_notes_title")}: </span>
                    <span className="whitespace-pre-wrap">{employee.liquidationNotes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Zona de peligro */}
            {employee && (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <h3 className="text-sm font-medium text-destructive">{tt("danger_zone")}</h3>
                <p className="text-xs text-muted-foreground">{tt("danger_explain")}</p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-1 self-start"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  {tt("delete_employee")}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{tt("documents_deferred")}</p>
          </div>
        </SheetContent>
      </Sheet>

      <EmployeeFormDialog mode="edit" employee={employee} open={editOpen} onOpenChange={setEditOpen} />
      {employee && (
        <LiquidationDialog
          employee={employee}
          open={liqOpen}
          onOpenChange={setLiqOpen}
          onSaved={() => router.refresh()}
        />
      )}
      {employee && (
        <DeleteEmployeeDialog
          employee={employee}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
