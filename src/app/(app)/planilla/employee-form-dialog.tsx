"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { createEmployeeAction, updateEmployeeAction } from "./actions";

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
  position: string;
  startDate: string;
  baseSalary: string;
  benefitsBaseSalary: string;
  phone: string;
  idDocument: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  contractInfo: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  position: "",
  startDate: "",
  baseSalary: "",
  benefitsBaseSalary: "",
  phone: "",
  idDocument: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  contractInfo: "",
  notes: "",
};

function fromEmployee(e: PayrollEmployee): FormState {
  return {
    name: e.name,
    position: e.position ?? "",
    startDate: e.startDate ?? "",
    baseSalary: e.baseSalaryCents ? (e.baseSalaryCents / 100).toFixed(2) : "",
    benefitsBaseSalary: e.benefitsBaseSalaryCents != null ? (e.benefitsBaseSalaryCents / 100).toFixed(2) : "",
    phone: e.phone ?? "",
    idDocument: e.idDocument ?? "",
    emergencyContactName: e.emergencyContactName ?? "",
    emergencyContactPhone: e.emergencyContactPhone ?? "",
    contractInfo: e.contractInfo ?? "",
    notes: e.notes ?? "",
  };
}

function toCents(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function EmployeeFormDialog({
  mode,
  employee,
  open,
  onOpenChange,
}: {
  mode: "add" | "edit";
  employee?: PayrollEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-sembrar cada vez que se abre (react no re-lee el estado inicial
  // en un componente que se reusa entre empleados). Correr en efecto,
  // no en render, porque `employee` puede cambiar de identidad entre
  // aperturas y el formulario debe reflejarlo.
  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el empleado editado cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && employee ? fromEmployee(employee) : EMPTY);
    setError(null);
  }, [open, mode, employee]);
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
      const common = {
        name: form.name.trim(),
        position: form.position.trim() || null,
        startDate: form.startDate || null,
        phone: form.phone.trim() || null,
        idDocument: form.idDocument.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        contractInfo: form.contractInfo.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (mode === "edit" && employee) {
        await updateEmployeeAction(employee.id, common);
      } else {
        await createEmployeeAction({
          ...common,
          baseSalaryCents: toCents(form.baseSalary),
          benefitsBaseSalaryCents: form.benefitsBaseSalary.trim() ? toCents(form.benefitsBaseSalary) : null,
        });
      }
      toast.success(t(lang, mode === "edit" ? strings.planilla.action_save : strings.planilla.action_add));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  return (
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
            <Field label={tt("f_position")}>
              <Input
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
                placeholder={tt("f_optional")}
              />
            </Field>
            <Field label={tt("f_start_date")}>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            {mode === "add" ? (
              <>
                <Field label={tt("f_base_salary")}>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.baseSalary}
                    onChange={(e) => set("baseSalary", e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
                <Field label={tt("f_benefits_salary")}>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.benefitsBaseSalary}
                    onChange={(e) => set("benefitsBaseSalary", e.target.value)}
                    placeholder={tt("f_benefits_hint")}
                  />
                </Field>
              </>
            ) : (
              <p className="text-xs text-muted-foreground sm:col-span-2">{tt("salary_edit_note")}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field label={tt("f_phone")}>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="6000-0000" />
            </Field>
            <Field label={tt("f_id_document")}>
              <Input
                value={form.idDocument}
                onChange={(e) => set("idDocument", e.target.value)}
                placeholder="8-123-4567"
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
