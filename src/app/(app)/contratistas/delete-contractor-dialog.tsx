"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

import type { Contractor } from "@/types/contractors";
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
import { deleteContractorAction } from "./actions";

/**
 * Confirmación explícita para BORRAR un contratista y TODO su estado de
 * cuenta (cascade sobre `contractor_ledger_entries`). Irreversible: hay
 * que escribir el nombre exacto. Deja claro que "inactivar" conserva y
 * "borrar" elimina.
 */
export function DeleteContractorDialog({
  contractor,
  open,
  onOpenChange,
  onDeleted,
}: {
  contractor: Contractor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

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

  const canDelete = confirmText.trim() === contractor.name.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteContractorAction(contractor.id);
      toast.success(tt("del_done"));
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
            {tt("del_dlg_title")}
          </DialogTitle>
          <DialogDescription>{tt("del_dlg_desc")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            {tt("del_warning")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {tt("del_type_name")}{" "}
              <span className="font-medium text-foreground">{contractor.name}</span>
            </Label>
            <Input
              value={confirmText}
              onChange={(ev) => setConfirmText(ev.target.value)}
              placeholder={contractor.name}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tt("action_cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!canDelete || submitting}>
              {submitting ? tt("saving") : tt("del_confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
