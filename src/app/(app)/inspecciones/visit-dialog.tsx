"use client";

import * as React from "react";
import toast from "react-hot-toast";

import type { Inspection } from "@/types/inspections";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { useDiscardGuard, useFormBaseline } from "@/components/shared/discard-guard";
import { ICON } from "@/lib/ui/concepts";
import { Textarea } from "@/components/ui/textarea";
import { todayInPanama } from "@/lib/contractors/contractor-loans";
import { createInspectionAction, updateInspectionAction } from "./actions";
import { useTi } from "./shared";

/** Nueva visita (fecha de hoy, nota opcional) o editar una. Al crear, sigue directo a agregar detalles. */
export function VisitDialog({
  open,
  projectId,
  visit,
  onClose,
  onCreated,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  /** null = nueva. */
  visit: Inspection | null;
  onClose: () => void;
  onCreated: (id: string) => void;
  onSaved: () => void;
}) {
  const { ti } = useTi();
  const [date, setDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const { isDirty, markSeeded } = useFormBaseline(() => JSON.stringify([date, notes]));
  const { requestClose, dialog: discardDialog } = useDiscardGuard(isDirty, onClose);

  /* eslint-disable react-hooks/set-state-in-effect -- el formulario se llena al abrir */
  React.useEffect(() => {
    if (!open) return;
    setDate(visit?.visitedOn ?? todayInPanama());
    setNotes(visit?.notes ?? "");
    markSeeded();
  }, [open, visit, markSeeded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    const input = { visitedOn: date, notes: notes.trim() || null };
    const res = visit ? await updateInspectionAction(visit.id, input) : await createInspectionAction(projectId, input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || ti("error"));
      return;
    }
    onSaved();
    if (!visit && typeof res.data === "string") onCreated(res.data);
    else toast.success(ti("saved"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && void requestClose()}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{visit ? ti("edit_visit") : ti("new_visit")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label={ti("f_date")} icon={ICON.date} required className="w-48">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={ti("f_notes")}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ti("f_notes_ph")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={saving}>
              {ti("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !date}>
              {visit ? ti("save") : ti("create_visit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {discardDialog}
    </Dialog>
  );
}
