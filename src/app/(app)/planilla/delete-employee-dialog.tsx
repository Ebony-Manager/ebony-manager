"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { deleteEmployeeAction } from "./actions";

/**
 * Confirmación explícita para BORRAR un empleado y toda su historia
 * (quincenas, ledger, préstamos, historial de sueldos — todo por
 * cascada). Irreversible: hay que escribir el nombre exacto para
 * habilitar el botón. Deja claro que "inactivar" conserva la historia y
 * "borrar" la elimina.
 */
export function DeleteEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onDeleted,
}: {
  employee: PayrollEmployee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.planilla) => t(lang, strings.planilla[k]);

  const [confirmText, setConfirmText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset al abrir. */
  React.useEffect(() => {
    if (!open) return;
    setConfirmText("");
    setError(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canDelete = confirmText.trim() === employee.name.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteEmployeeAction(employee.id);
      toast.success(tt("delete_done"));
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            {tt("delete_title")}
          </DialogTitle>
          <DialogDescription>{tt("delete_desc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            {tt("delete_warning")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {tt("delete_type_name")} <span className="font-medium text-foreground">{employee.name}</span>
            </Label>
            <Input
              value={confirmText}
              onChange={(ev) => setConfirmText(ev.target.value)}
              placeholder={employee.name}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!canDelete || submitting}>
              {submitting ? tt("saving") : tt("delete_confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
