"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { updateEmployeeAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

/**
 * Dar de baja a un empleado (o editar su baja): el último día que trabajó y
 * notas. Queda inactivo con esa fecha en `endDate`, que es a la vez:
 *  - el último día trabajado (asistencia y quincena: lo de después no son faltas),
 *  - la fecha de liquidación de sus prestaciones, si las tiene (Décimo,
 *    Vacación y Prima de Antigüedad se calculan hasta ahí y vuelven a cero).
 * Ya no se liquida a alguien que sigue trabajando (decisión de Ebony).
 */
export function LiquidationDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: PayrollEmployee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  // Editar = ya está de baja (inactivo con fecha).
  const isEditing = employee.status === "INACTIVE" && employee.endDate !== null;
  const hasBenefits = employee.benefitsEnabled && !employee.benefitsExternalCompany;

  const [endDate, setEndDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el empleado cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setEndDate(employee.status === "INACTIVE" && employee.endDate ? employee.endDate : todayInPanama());
    setNotes(employee.liquidationNotes ?? "");
    setError(null);
  }, [open, employee]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit() {
    if (!endDate) {
      setError(tt("liq_f_date_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateEmployeeAction(employee.id, {
        endDate,
        liquidationNotes: notes.trim() || null,
        status: "INACTIVE",
      });
      toast.success(tt(isEditing ? "off_saved" : "off_done"));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? tt("off_edit") : tt("off_title")}
      description={employee.name}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={isEditing ? tt("action_save") : tt("off_confirm")}
      error={error}
    >
      <Field label={tt("off_f_date")}>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full min-w-0" />
      </Field>
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {hasBenefits ? tt("off_hint_benefits") : tt("off_hint")}
      </p>
      <Field label={tt("off_f_notes")}>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
