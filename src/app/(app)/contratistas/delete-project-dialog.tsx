"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

import type { Project } from "@/types/contractors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/context/language-context";
import { t, strings } from "@/lib/i18n";
import { deleteProjectAction } from "./actions";

/**
 * Borrar un proyecto. NO borra movimientos: los que lo tenían enganchado
 * quedan con `project_id = NULL` (FK `on delete set null`). Confirmación
 * simple — a diferencia de borrar un contratista, acá no se pierde plata.
 */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { lang } = useLang();
  const tt = (k: keyof typeof strings.contratistas) => t(lang, strings.contratistas[k]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await deleteProjectAction(project.id);
      if (!res.ok) throw new Error(res.error);
      toast.success(tt("proj_deleted"));
      onOpenChange(false);
      onDeleted?.();
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
            {tt("proj_delete_title")}
          </DialogTitle>
          <DialogDescription>
            {project.name} — {tt("proj_delete_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {tt("proj_delete_keeps_moves")}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tt("action_cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={submitting}>
            {submitting ? tt("saving") : tt("proj_delete_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
