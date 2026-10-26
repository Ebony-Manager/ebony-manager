"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Settings } from "lucide-react";

import type { BankAccountType, EmployeeCategoria, PayrollEmployee, PayrollPosition } from "@/types/planilla";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { CountrySelect } from "@/components/shared/country-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createEmployeeAction, updateEmployeeAction } from "./actions";
import { ManagePositionsDialog } from "./manage-positions-dialog";
import { SalaryRaiseDialog } from "./salary-raise-dialog";
import { formatCents } from "@/lib/planilla/payroll-period";

const NO_ACCOUNT_TYPE = "__none__";
// Sentinel del Select de "Posición" cuando el valor no es (o ya no es) una
// posición activa del catálogo — muestra el input de texto libre debajo.
// Mismo patrón que NO_ACCOUNT_TYPE arriba.
const OTHER_POSITION = "__other__";

/**
 * Alta y edición de un empleado de planilla en un solo diálogo. Inputs
 * controlados con `useState`, sin react-hook-form/zod.
 *
 * SUELDO: los campos de sueldo solo aparecen al DAR DE ALTA (se guardan
 * como la primera fila del historial). En modo edición NO se pueden
 * tocar — el sueldo solo cambia registrando un aumento en la sección
 * "Sueldo / Aumentos" del perfil. Tampoco toca `status`/`endDate`/
 * liquidación (flujo propio en el perfil).
 */

interface FormState {
  name: string;
  categoria: EmployeeCategoria;
  /** Valor del Select de "Posición": el nombre de una posición ACTIVA del
   *  catálogo, o `OTHER_POSITION` — nunca el nombre de una inactiva (esa
   *  cae a "Otro" con el texto precargado, ver `fromEmployee`). */
  positionSelect: string;
  /** Texto libre real que se guarda en `position` cuando `positionSelect`
   *  es `OTHER_POSITION` — incluye el caso "no coincide con el catálogo". */
  positionOther: string;
  startDate: string;
  baseSalary: string;
  benefitsBaseSalary: string;
  phone: string;
  idDocument: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  contractInfo: string;
  notes: string;
  bankName: string;
  bankAccountType: BankAccountType | typeof NO_ACCOUNT_TYPE;
  idDocumentType: "cedula" | "pasaporte" | typeof NO_ACCOUNT_TYPE;
  nationality: string;
  birthDate: string;
  email: string;
  address: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  benefitsEnabled: boolean;
  benefitsExternalCompany: string;
}

/** Datos con los que puede llegar prellenada el alta (ej. desde un registro de JotForm). */
export type EmployeePrefill = Partial<
  Pick<
    FormState,
    | "name"
    | "phone"
    | "email"
    | "address"
    | "birthDate"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "bankName"
    | "bankAccountType"
    | "bankAccountNumber"
    | "notes"
    | "idDocument"
    | "idDocumentType"
    | "nationality"
  >
>;

const EMPTY: FormState = {
  name: "",
  categoria: "taller",
  positionSelect: OTHER_POSITION,
  positionOther: "",
  startDate: "",
  baseSalary: "",
  benefitsBaseSalary: "",
  phone: "",
  idDocument: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  contractInfo: "",
  notes: "",
  bankName: "",
  bankAccountType: NO_ACCOUNT_TYPE,
  idDocumentType: NO_ACCOUNT_TYPE,
  nationality: "",
  birthDate: "",
  email: "",
  address: "",
  bankAccountNumber: "",
  bankRoutingCode: "",
  // Casi nadie lleva prestaciones en la planilla: un empleado nuevo arranca
  // sin ellas y se marcan a mano si le tocan.
  benefitsEnabled: false,
  benefitsExternalCompany: "",
};

/** `activePositions` es el catálogo VIGENTE (ya filtrado a activas por el
 *  llamador) — si `e.position` no coincide con ninguna, el Select arranca
 *  en "Otro" con ese texto precargado (compatibilidad con lo ya cargado a
 *  mano, incluida una posición que existía y se desactivó después). */
function fromEmployee(e: PayrollEmployee, activePositions: PayrollPosition[]): FormState {
  const matchesActive = e.position !== null && activePositions.some((p) => p.name === e.position);
  return {
    name: e.name,
    categoria: e.categoria,
    positionSelect: matchesActive ? e.position! : OTHER_POSITION,
    positionOther: matchesActive ? "" : (e.position ?? ""),
    startDate: e.startDate ?? "",
    baseSalary: e.baseSalaryCents ? (e.baseSalaryCents / 100).toFixed(2) : "",
    benefitsBaseSalary: e.benefitsBaseSalaryCents != null ? (e.benefitsBaseSalaryCents / 100).toFixed(2) : "",
    phone: e.phone ?? "",
    idDocument: e.idDocument ?? "",
    emergencyContactName: e.emergencyContactName ?? "",
    emergencyContactPhone: e.emergencyContactPhone ?? "",
    contractInfo: e.contractInfo ?? "",
    notes: e.notes ?? "",
    bankName: e.bankName ?? "",
    bankAccountType: e.bankAccountType ?? NO_ACCOUNT_TYPE,
    idDocumentType: e.idDocumentType ?? NO_ACCOUNT_TYPE,
    nationality: e.nationality ?? "",
    birthDate: e.birthDate ?? "",
    email: e.email ?? "",
    address: e.address ?? "",
    bankAccountNumber: e.bankAccountNumber ?? "",
    bankRoutingCode: e.bankRoutingCode ?? "",
    benefitsEnabled: e.benefitsEnabled,
    benefitsExternalCompany: e.benefitsExternalCompany ?? "",
  };
}

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function EmployeeFormDialog({
  mode,
  employee,
  positions,
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  mode: "add" | "edit";
  employee?: PayrollEmployee | null;
  positions: PayrollPosition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solo en "add": el formulario abre con estos datos ya puestos. */
  prefill?: EmployeePrefill;
  /** Solo en "add": después de crear, con el id del empleado nuevo. */
  onCreated?: (employeeId: string) => void | Promise<void>;
}) {
  const { lang } = useLang();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [managePositionsOpen, setManagePositionsOpen] = React.useState(false);
  const [raiseOpen, setRaiseOpen] = React.useState(false);
  // Sueldo mostrado en modo edición: parte del que trae el empleado y se
  // actualiza al toque cuando se registra uno desde acá.
  const [salaryShown, setSalaryShown] = React.useState<{ monthly: number; benefits: number | null }>({
    monthly: 0,
    benefits: null,
  });

  // Copia local del catálogo, sembrada de la prop (que viene del server)
  // pero actualizable al toque desde ManagePositionsDialog — así el Select
  // de "Posición" refleja un alta/edición reciente sin esperar a que
  // router.refresh() vuelva a bajar la prop por el árbol de server
  // components. Ver el doc comment de ManagePositionsDialog.
  const [positionsList, setPositionsList] = React.useState(positions);
  /* eslint-disable react-hooks/set-state-in-effect -- solo re-sincroniza si la prop del servidor cambia por su cuenta (ej. otra pestaña). */
  React.useEffect(() => {
    setPositionsList(positions);
  }, [positions]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const activePositions = positionsList.filter((p) => p.active);

  // Re-sembrar cada vez que se abre (react no re-lee el estado inicial en
  // un componente que se reusa entre empleados). Correr en efecto, no en
  // render, porque `employee` puede cambiar de identidad entre aperturas y
  // el formulario debe reflejarlo. Deliberadamente sin `positionsList` en
  // las deps: solo importa el catálogo AL ABRIR, no en cada cambio
  // mientras el usuario ya está escribiendo (editarlo desde
  // ManagePositionsDialog, con este formulario abierto detrás, no debe
  // resetear lo que la persona ya tenía tipeado).
  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el empleado editado cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && employee ? fromEmployee(employee, activePositions) : { ...EMPTY, ...prefill });
    setSalaryShown({ monthly: employee?.baseSalaryCents ?? 0, benefits: employee?.benefitsBaseSalaryCents ?? null });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentario arriba: catálogo solo importa al abrir.
  }, [open, mode, employee, prefill]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t(lang, strings.planilla.f_name_required));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const position = form.positionSelect === OTHER_POSITION ? form.positionOther.trim() || null : form.positionSelect;
      const common = {
        name: form.name.trim(),
        position,
        categoria: form.categoria,
        startDate: form.startDate || null,
        phone: form.phone.trim() || null,
        idDocument: form.idDocument.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        contractInfo: form.contractInfo.trim() || null,
        notes: form.notes.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccountType: form.bankAccountType === NO_ACCOUNT_TYPE ? null : form.bankAccountType,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        bankRoutingCode: form.bankRoutingCode.trim() || null,
      };
      // Campos de la ficha ampliada: solo viajan si cambiaron (edición) o
      // traen valor (alta), así guardar el formulario sigue funcionando
      // aunque la migración 20261008120000 aún no se haya aplicado.
      const docType = form.idDocumentType === NO_ACCOUNT_TYPE ? null : form.idDocumentType;
      const nationality = form.nationality.trim() || null;
      const birthDate = form.birthDate || null;
      const email = form.email.trim() || null;
      const address = form.address.trim() || null;
      const profileExtra =
        mode === "edit" && employee
          ? {
              ...(form.benefitsEnabled !== employee.benefitsEnabled ? { benefitsEnabled: form.benefitsEnabled } : {}),
              ...((form.benefitsExternalCompany.trim() || null) !== employee.benefitsExternalCompany
                ? { benefitsExternalCompany: form.benefitsExternalCompany.trim() || null }
                : {}),
              ...(docType !== employee.idDocumentType ? { idDocumentType: docType } : {}),
              ...(nationality !== employee.nationality ? { nationality } : {}),
              ...(birthDate !== employee.birthDate ? { birthDate } : {}),
              ...(email !== employee.email ? { email } : {}),
              ...(address !== employee.address ? { address } : {}),
            }
          : {
              ...(!form.benefitsEnabled ? { benefitsEnabled: false } : {}),
              ...(form.benefitsExternalCompany.trim() ? { benefitsExternalCompany: form.benefitsExternalCompany.trim() } : {}),
              ...(docType ? { idDocumentType: docType } : {}),
              ...(nationality ? { nationality } : {}),
              ...(birthDate ? { birthDate } : {}),
              ...(email ? { email } : {}),
              ...(address ? { address } : {}),
            };
      if (mode === "edit" && employee) {
        await updateEmployeeAction(employee.id, { ...common, ...profileExtra });
      } else {
        const created = await createEmployeeAction({
          ...common,
          ...profileExtra,
          baseSalaryCents: toCents(form.baseSalary),
          benefitsBaseSalaryCents: form.benefitsBaseSalary.trim() ? toCents(form.benefitsBaseSalary) : null,
        });
        await onCreated?.(created.id);
      }
      toast.success(t(lang, mode === "edit" ? strings.planilla.action_save : strings.planilla.action_add));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit"
                ? `${tt("action_edit")} · ${employee?.name ?? ""}`
                : tt("dlg_add_title")}
            </DialogTitle>
            <DialogDescription>
              {mode === "edit" ? tt("dlg_edit_desc") : tt("dlg_add_desc")}
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tt("f_name")} className="sm:col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={tt("f_name_ph")}
                  autoFocus
                />
              </Field>
              <Field label={tt("f_categoria")}>
                <Select value={form.categoria} onValueChange={(v) => set("categoria", v as EmployeeCategoria)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taller">{tt("categoria_taller")}</SelectItem>
                    <SelectItem value="administrativo">{tt("categoria_administrativo")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{tt("f_position")}</Label>
                  <button
                    type="button"
                    onClick={() => setManagePositionsOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                    title={tt("manage_positions")}
                    aria-label={tt("manage_positions")}
                  >
                    <Settings className="size-3.5" />
                  </button>
                </div>
                <Select value={form.positionSelect} onValueChange={(v) => set("positionSelect", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activePositions.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_POSITION}>{tt("position_other")}</SelectItem>
                  </SelectContent>
                </Select>
                {form.positionSelect === OTHER_POSITION && (
                  <Input
                    value={form.positionOther}
                    onChange={(e) => set("positionOther", e.target.value)}
                    placeholder={tt("position_other_ph")}
                  />
                )}
              </div>
              <Field label={tt("f_start_date")}>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              {mode === "add" ? (
                <>
                  <Field label={tt("f_base_salary")}>
                    <MoneyInput value={form.baseSalary} onValueChange={(v) => set("baseSalary", v)} />
                  </Field>
                  <Field label={tt("f_benefits_salary")}>
                    <MoneyInput
                      value={form.benefitsBaseSalary}
                      onValueChange={(v) => set("benefitsBaseSalary", v)}
                      placeholder={tt("f_benefits_hint")}
                    />
                  </Field>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 sm:col-span-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{tt("current_salary")}</p>
                    {salaryShown.monthly > 0 ? (
                      <p className="text-sm font-medium text-foreground">
                        {formatCents(salaryShown.monthly)} {tt("per_month")}
                        {salaryShown.benefits != null && salaryShown.benefits !== salaryShown.monthly && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            · {tt("f_benefits_salary")}: {formatCents(salaryShown.benefits)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{tt("salary_not_set")}</p>
                    )}
                    {form.benefitsExternalCompany.trim() && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {tt("raise_f_external")} {form.benefitsExternalCompany.trim()}:{" "}
                        <span className="font-medium text-foreground">
                          {salaryShown.benefits != null ? `${formatCents(salaryShown.benefits)} ${tt("per_month")}` : tt("external_salary_missing")}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setRaiseOpen(true)}>
                      {salaryShown.monthly > 0 ? tt("register_raise") : tt("set_salary")}
                    </Button>
                    {form.benefitsExternalCompany.trim() && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        onClick={() => setRaiseOpen(true)}
                      >
                        {tt("raise_f_external")} {form.benefitsExternalCompany.trim()}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.benefitsEnabled}
                onChange={(e) => set("benefitsEnabled", e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">{tt("f_benefits_enabled")}</span>
                <span className="block text-xs text-muted-foreground">{tt("f_benefits_enabled_hint")}</span>
              </span>
            </label>
            {form.benefitsEnabled && (
              <Field label={tt("f_benefits_external")} className="sm:col-span-2">
                <Input
                  value={form.benefitsExternalCompany}
                  onChange={(e) => set("benefitsExternalCompany", e.target.value)}
                  placeholder={tt("f_benefits_external_ph")}
                />
                <p className="text-xs text-muted-foreground">{tt("f_benefits_external_hint")}</p>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <Field label={tt("f_phone")}>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="6000-0000" />
              </Field>
              <Field label={tt("f_id_document_type")}>
                <Select
                  value={form.idDocumentType}
                  onValueChange={(v) => set("idDocumentType", v as FormState["idDocumentType"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT_TYPE}>{tt("f_optional")}</SelectItem>
                    <SelectItem value="cedula">{tt("id_type_cedula")}</SelectItem>
                    <SelectItem value="pasaporte">{tt("id_type_pasaporte")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={tt("f_id_document")}>
                <Input
                  value={form.idDocument}
                  onChange={(e) => set("idDocument", e.target.value)}
                  placeholder="8-123-4567"
                />
              </Field>
              <Field label={tt("f_nationality")}>
                <CountrySelect value={form.nationality || null} onChange={(code) => set("nationality", code ?? "")} />
              </Field>
              <Field label={tt("f_birth_date")}>
                <Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
              </Field>
              <Field label={tt("f_email")}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder={tt("f_optional")}
                />
              </Field>
              <Field label={tt("f_address")} className="sm:col-span-2">
                <Input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder={tt("f_address_ph")}
                />
              </Field>
              <Field label={tt("f_emg_name")}>
                <Input
                  value={form.emergencyContactName}
                  onChange={(e) => set("emergencyContactName", e.target.value)}
                  placeholder={tt("f_optional")}
                />
              </Field>
              <Field label={tt("f_emg_phone")}>
                <Input
                  value={form.emergencyContactPhone}
                  onChange={(e) => set("emergencyContactPhone", e.target.value)}
                  placeholder="6000-0000"
                />
              </Field>
              <Field label={tt("f_contract")} className="sm:col-span-2">
                <Input
                  value={form.contractInfo}
                  onChange={(e) => set("contractInfo", e.target.value)}
                  placeholder={tt("f_contract_ph")}
                />
              </Field>
              <Field label={tt("f_notes")} className="sm:col-span-2">
                <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground">{tt("bank_section_title")}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tt("f_bank_name")}>
                  <Input
                    value={form.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    placeholder={tt("f_optional")}
                  />
                </Field>
                <Field label={tt("f_bank_account_type")}>
                  <Select
                    value={form.bankAccountType}
                    onValueChange={(v) => set("bankAccountType", v as FormState["bankAccountType"])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ACCOUNT_TYPE}>{tt("f_optional")}</SelectItem>
                      <SelectItem value="ahorro">{tt("bank_type_ahorro")}</SelectItem>
                      <SelectItem value="corriente">{tt("bank_type_corriente")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={tt("f_bank_routing_code")}>
                  <Input
                    value={form.bankRoutingCode}
                    onChange={(e) => set("bankRoutingCode", e.target.value)}
                    placeholder={tt("f_optional")}
                  />
                </Field>
                <Field label={tt("f_bank_account_number")}>
                  <Input
                    value={form.bankAccountNumber}
                    onChange={(e) => set("bankAccountNumber", e.target.value)}
                    placeholder={tt("f_optional")}
                  />
                </Field>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {tt("action_cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? tt("saving")
                  : mode === "edit"
                    ? tt("action_save")
                    : tt("action_add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {mode === "edit" && employee && (
        <SalaryRaiseDialog
          employeeId={employee.id}
          externalCompany={form.benefitsExternalCompany.trim() || employee.benefitsExternalCompany}
          currentMonthlyCents={salaryShown.monthly}
          currentBenefitsCents={salaryShown.benefits}
          defaultFrom={
            salaryShown.monthly === 0 && employee.startDate
              ? (() => {
                  const [y, m, d] = employee.startDate.split("-").map(Number);
                  return { year: y, month: m, half: d <= 15 ? (1 as const) : (2 as const) };
                })()
              : undefined
          }
          open={raiseOpen}
          onOpenChange={setRaiseOpen}
          onSaved={(saved) => setSalaryShown({ monthly: saved.monthlySalaryCents, benefits: saved.benefitsBaseSalaryCents })}
        />
      )}

      <ManagePositionsDialog
        open={managePositionsOpen}
        onOpenChange={setManagePositionsOpen}
        onPositionsChanged={setPositionsList}
      />
    </>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
