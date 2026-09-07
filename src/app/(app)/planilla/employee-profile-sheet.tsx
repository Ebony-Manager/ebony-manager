"use client";

import * as React from "react";
import { Pencil, Phone } from "lucide-react";

import type { PayrollEmployee } from "@/types/planilla";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/planilla/payroll-period";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { EmployeeAvatar } from "./employee-avatar";
import { EmployeeFormDialog } from "./employee-form-dialog";

/** Fecha `YYYY-MM-DD` -> texto local, sin depender de un helper de otro
 *  módulo (Atlas usaba `@/lib/finance/format-date`). */
function formatDate(lang: "es" | "en", iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "en" ? "en-US" : "es-PA", { day: "numeric", month: "short", year: "numeric" });
}

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
 * Perfil de solo lectura de un empleado — datos personales/de contacto
 * más salario. "Editar" abre EmployeeFormDialog. Portado de Atlas; la
 * sección de Documentos (subida de archivos) queda para más adelante.
 * Terminar el empleo NO se hace desde acá (flujo propio, Tanda B2).
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
  const [editOpen, setEditOpen] = React.useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <div className="flex items-center gap-3">
              {employee && (
                <EmployeeAvatar
                  name={employee.name}
                  employeeId={employee.id}
                  sortOrder={employee.sortOrder}
                  size="md"
                />
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
              <ProfileField
                label={tt("f_base_salary")}
                value={employee ? formatCents(employee.baseSalaryCents) : null}
              />
              {employee?.benefitsBaseSalaryCents != null &&
                employee.benefitsBaseSalaryCents !== employee.baseSalaryCents && (
                  <ProfileField
                    label={tt("f_benefits_salary")}
                    value={formatCents(employee.benefitsBaseSalaryCents)}
                  />
                )}
            </div>

            {employee?.notes && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {employee.notes}
              </div>
            )}

            <p className="text-xs text-muted-foreground">{tt("documents_deferred")}</p>
          </div>
        </SheetContent>
      </Sheet>

      <EmployeeFormDialog mode="edit" employee={employee} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
