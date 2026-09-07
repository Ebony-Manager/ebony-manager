"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import type { PayrollEmployee } from "@/types/planilla";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { updateEmployeeAction } from "./actions";
import { FormDialog, Field } from "./form-dialog";

/**
 * Marca (o edita) la liquidación de un empleado: la fecha exacta en que
 * se saldaron las prestaciones (Décimo/Vacación/Prima) + notas de esa
 * liquidación. NUNCA toca `status` — liquidar no siempre significa que
 * la persona dejó de trabajar (portado de Atlas: el activar/desactivar
 * es un botón aparte). `endDate` es solo el ancla de reinicio de los
 * acumulados.
 */
export function LiquidationDialog({
  employee,
  open,
  onOpenChange,
  onSaved,
}: {
  employee: PayrollEmployee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);
  const router = useRouter();
  const isEditing = employee.endDate !== null;

  const [endDate, setEndDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- re-siembra al abrir; el empleado cambia entre aperturas. */
  React.useEffect(() => {
    if (!open) return;
    setEndDate(employee.endDate ?? "");
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
      });
      toast.success(tt(isEditing ? "liq_edit" : "liq_mark"));
      onOpenChange(false);
      onSaved();
      router.refresh();
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
      title={isEditing ? tt("liq_edit") : tt("liq_mark")}
      description={`${employee.name} — ${tt("liq_desc")}`}
      onSubmit={onSubmit}
      submitting={submitting}
      submitLabel={isEditing ? tt("action_save") : tt("liq_mark")}
      error={error}
    >
      <p className="text-xs text-muted-foreground">{tt("liq_hint")}</p>
      <Field label={tt("liq_f_date")}>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </Field>
      <Field label={tt("liq_f_notes")}>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
