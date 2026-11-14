"use client";

import { usePageTitle } from "@/components/shared/page-title";
import { ICON } from "@/lib/ui/concepts";
import { ProfileCard } from "@/components/shared/profile-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { strings as titleStrings, t as titleT } from "@/lib/i18n";
import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LogOut, Pencil, Settings, Trash2, UserCheck } from "lucide-react";

import type { ComponentProps } from "react";

import type { PayrollEmployee, PayrollLedgerEntry, PayrollLoanWithSchedule, PayrollPosition, PayrollSalaryChange } from "@/types/planilla";
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
import { EmployeeAccessLine } from "@/app/(app)/settings/usuarios/employee-access-card";
import type { AppUser } from "@/types/usuarios";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { SalaryHistorySection } from "./salary-history-section";
import { EmployeeBenefitsSection } from "./employee-benefits-section";
import { EmployeeStatementSection } from "./employee-statement-section";
import { EmployeeLoansSection } from "./employee-loans-section";
import { ProfilePhotoPicker } from "@/components/shared/profile-photo-picker";
import { IdDocumentFile } from "@/components/shared/id-document-file";
import { jotformDocumentUrlFromNotes } from "@/lib/personal/jotform-intake";
import { importJotformDocumentAction } from "@/app/(app)/personal/staff/actions";
import { countryName } from "@/lib/countries";
import { employeeBackPath, type EmployeeFrom } from "@/lib/personal/paths";
import { EmployeePhotosProvider } from "./employee-photos-context";
import { LiquidationDialog } from "./liquidation-dialog";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";
import { BackLink, PAGE_CLASS } from "@/components/shared/page-header";

function DataItem({
  label,
  value,
  hideWhenEmpty = false,
}: {
  label: string;
  value: React.ReactNode;
  hideWhenEmpty?: boolean;
}) {
  const { lang } = useLang();
  if (!value && hideWhenEmpty) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "text-foreground" : "text-muted-foreground/70"}>
        {value || t(lang, strings.planilla.pd_not_set)}
      </dd>
    </div>
  );
}

/**
 * Perfil del empleado a pantalla completa (Taller · Tanda 1) — mismo
 * patrón visual que la ficha del contratista: volver + engranaje arriba,
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
export function EmployeeProfileView({
  employee,
  positions,
  photoUrl: initialPhotoUrl,
  documentUrl,
  initial,
  loans,
  from,
  access,
}: {
  employee: PayrollEmployee;
  positions: PayrollPosition[];
  photoUrl: string | null;
  /** URL firmada del documento (cédula / pasaporte), si tiene. */
  documentUrl: string | null;
  /** Datos de las secciones ya cargados por el servidor (en paralelo con el
   *  empleado), para que la página abra con todo en vez de pedirlo por
   *  separado y en fila después de pintarse. */
  /** Pantalla desde la que se llegó (a ella regresa "Volver"); sin esto, a Staff. */
  from?: EmployeeFrom;
  initial?: {
    detail: ComponentProps<typeof EmployeeStatementSection>["initialDetail"];
    ledger: PayrollLedgerEntry[];
    salaryChanges: PayrollSalaryChange[];
  };
  loans: PayrollLoanWithSchedule[];
  /** Su acceso a la app (solo para el administrador): null = todavía no tiene; sin esta propiedad, no se muestra la tarjeta. */
  access?: AppUser | null;
}) {
  usePageTitle([employee.name, titleT(useLang().lang, titleStrings.titles.employee)]);
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();

  const [editOpen, setEditOpen] = React.useState(false);
  const [liqOpen, setLiqOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [togglingStatus, setTogglingStatus] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(initialPhotoUrl);
  const [photoPath, setPhotoPath] = React.useState<string | null>(employee.photoPath);

  async function toggleStatus() {
    setTogglingStatus(true);
    try {
      await updateEmployeeAction(employee.id, {
        status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      toast.success(tt(employee.status === "ACTIVE" ? "mark_inactive" : "reactivate"));
    } finally {
      setTogglingStatus(false);
    }
  }

  const isInactive = employee.status === "INACTIVE";
  const hasBankAccount = Boolean(
    employee.bankName || employee.bankAccountType || employee.bankAccountNumber || employee.bankRoutingCode,
  );
  const bankAccountTypeLabel =
    employee.bankAccountType === "ahorro"
      ? tt("bank_type_ahorro")
      : employee.bankAccountType === "corriente"
        ? tt("bank_type_corriente")
        : null;

  return (
    <EmployeePhotosProvider photoUrls={photoUrl ? { [employee.id]: photoUrl } : {}}>
      <div className={PAGE_CLASS}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <BackLink href={employeeBackPath(from)} label={t(lang, strings.common.back)} />

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
                {/* Dar de baja: último día trabajado (y liquidación de prestaciones si las tiene) + inactivo, en un paso. */}
                <DropdownMenuItem onSelect={() => window.setTimeout(() => setLiqOpen(true), 0)}>
                  <LogOut className="size-3.5" />
                  {isInactive ? tt("off_edit") : tt("off_title")}
                </DropdownMenuItem>
                {isInactive && (
                  <DropdownMenuItem disabled={togglingStatus} onSelect={() => toggleStatus()}>
                    <UserCheck className="size-3.5" />
                    {tt("reactivate")}
                  </DropdownMenuItem>
                )}
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

          {/* Tarjeta de encabezado: foto + nombre + posición + estado a la
              izquierda, sueldo mensual a la derecha. */}
          <Card className="flex flex-col gap-3 p-4">
            {/* Foto a la izquierda; a la derecha, nombre y cargo con el área, y el salario (en escritorio, al extremo). */}
            <div className="flex items-start gap-4">
              <ProfilePhotoPicker
                bucket="employee-photos"
                ownerId={employee.id}
                currentPath={photoPath}
                hasPhoto={photoUrl !== null}
                savePath={(path) => updateEmployeeAction(employee.id, { photoPath: path })}
                onPhotoChange={(url, path) => {
                  setPhotoUrl(url);
                  setPhotoPath(path);
                }}
              >
                <EmployeeAvatar name={employee.name} employeeId={employee.id} sortOrder={employee.sortOrder} size="lg" />
              </ProfilePhotoPicker>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                    {employee.name}
                    {isInactive && <StatusBadge status="record_inactive">{tt("inactive")}</StatusBadge>}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{employee.position || tt("no_position")}</span>
                    <Badge variant="outline">
                      {employee.categoria === "administrativo" ? tt("categoria_administrativo") : tt("categoria_taller")}
                    </Badge>
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs text-muted-foreground">{tt("base_salary_month")}</p>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatCents(employee.baseSalaryCents)}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">{tt("per_month")}</span>
                  </p>
                </div>
              </div>
            </div>

            {access !== undefined && (
              <EmployeeAccessLine
                person={{ id: employee.id, name: employee.name, position: employee.position, email: employee.email, active: !isInactive }}
                access={access}
              />
            )}
          </Card>
        </div>

        {/* Datos del empleado — la "ficha" con todo lo que se sabe de la persona. */}
        <ProfileCard
          icon={ICON.client}
          title={tt("pd_title")}
          action={
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
              {tt("pd_edit")}
            </Button>
          }
        >
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <DataItem
              label={tt("pd_document")}
              value={
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {employee.idDocument ? (
                    `${employee.idDocumentType === "pasaporte" ? tt("id_type_pasaporte") : employee.idDocumentType === "cedula" ? tt("id_type_cedula") : ""} ${employee.idDocument}`.trim()
                  ) : (
                    <span className="text-muted-foreground/70">{tt("pd_not_set")}</span>
                  )}
                  <IdDocumentFile
                    kind="employee"
                    ownerId={employee.id}
                    initialPath={employee.idDocumentPath}
                    initialUrl={documentUrl}
                    savePath={(path) => updateEmployeeAction(employee.id, { idDocumentPath: path })}
                    importFromJotform={
                      jotformDocumentUrlFromNotes(employee.notes) ? () => importJotformDocumentAction("employee", employee.id) : undefined
                    }
                  />
                </span>
              }
            />
            <DataItem label={tt("f_nationality")} value={countryName(employee.nationality, lang)} />
            <DataItem
              label={tt("f_birth_date")}
              value={employee.birthDate ? formatDate(lang, employee.birthDate) : null}
            />
            <DataItem label={tt("f_phone")} value={employee.phone} />
            <DataItem
              label={tt("f_email")}
              value={
                employee.email ? (
                  <a href={`mailto:${employee.email}`} className="break-all hover:text-primary">
                    {employee.email}
                  </a>
                ) : null
              }
            />
            <DataItem label={tt("f_address")} value={employee.address} />
            <DataItem
              label={tt("pd_contact")}
              value={
                employee.emergencyContactName || employee.emergencyContactPhone
                  ? [employee.emergencyContactName, employee.emergencyContactPhone].filter(Boolean).join(" · ")
                  : null
              }
            />
            <DataItem label={tt("f_contract")} value={employee.contractInfo} />
            <DataItem label={tt("pd_position")} value={employee.position} />
            <DataItem
              label={tt("pd_start_date")}
              value={employee.startDate ? formatDate(lang, employee.startDate) : null}
            />
            <DataItem
              label={tt("pd_end_date")}
              value={employee.endDate ? formatDate(lang, employee.endDate) : null}
              hideWhenEmpty
            />
            <DataItem
              label={tt("pd_bank")}
              value={
                hasBankAccount
                  ? [employee.bankName, bankAccountTypeLabel, employee.bankAccountNumber].filter(Boolean).join(" · ")
                  : null
              }
            />
            <DataItem label={tt("f_bank_routing_code")} value={employee.bankRoutingCode} hideWhenEmpty />
          </dl>
        </ProfileCard>

        {employee.notes && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {employee.notes}
          </div>
        )}

        {employee.liquidationNotes && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{tt("liq_notes_title")}: </span>
            <span className="whitespace-pre-wrap">{employee.liquidationNotes}</span>
          </div>
        )}

        {/* Mismo orden que la ficha del contratista: sueldo, prestaciones, préstamos y, al final, el estado de cuenta. */}
        <SalaryHistorySection employee={employee} initialChanges={initial?.salaryChanges} />

        <EmployeeBenefitsSection employee={employee} initialDetail={initial?.detail} />

        <EmployeeLoansSection employee={employee} loans={loans} />

        <EmployeeStatementSection employee={employee} initialDetail={initial?.detail} />
      </div>

      <EmployeeFormDialog
        mode="edit"
        employee={employee}
        positions={positions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <LiquidationDialog
        employee={employee}
        open={liqOpen}
        onOpenChange={setLiqOpen}
      />
      <DeleteEmployeeDialog
        employee={employee}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push(employeeBackPath(from))}
      />
    </EmployeePhotosProvider>
  );
}
